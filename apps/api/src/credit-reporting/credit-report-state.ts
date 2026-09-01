import {
  ActivityActorType,
  ActivityEventType,
  CreditBureauReportEventType,
  CreditBureauReportStatus,
  LedgerEntrySide,
  LedgerEntryStatus,
  LedgerEntryType,
  PaymentAllocationStatus,
  Prisma,
} from "@prisma/client";

const reportableDebitTypes: LedgerEntryType[] = [
  LedgerEntryType.PRINCIPAL,
  LedgerEntryType.INTEREST,
  LedgerEntryType.COLLECTION_FEE,
  LedgerEntryType.EXPENSE,
  LedgerEntryType.COURT_COST,
  LedgerEntryType.ENFORCEMENT_COST,
];

export async function creditReportingOpenAmount(client: Prisma.TransactionClient | import("../prisma/prisma.service").PrismaService, tenantId: string, caseId: string) {
  const entries = await client.caseLedgerEntry.findMany({
    where: { tenantId, caseId, status: LedgerEntryStatus.ACTIVE, side: LedgerEntrySide.DEBIT, type: { in: reportableDebitTypes } },
    include: { targetAllocations: { where: { status: PaymentAllocationStatus.ACTIVE } } },
  });
  return entries.reduce((total, entry) => {
    const allocated = entry.targetAllocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0));
    return total.plus(Prisma.Decimal.max(0, entry.amount.minus(allocated)));
  }, new Prisma.Decimal(0));
}

export async function markCreditReportsForCaseReview(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; caseId: string; reasonCode: string; actorMembershipId?: string },
) {
  const reports = await tx.creditBureauReport.findMany({
    where: { tenantId: input.tenantId, caseId: input.caseId, status: { in: [CreditBureauReportStatus.APPROVED, CreditBureauReportStatus.READY_FOR_SUBMISSION, CreditBureauReportStatus.SETTLED] } },
    include: { case: { select: { debtorPartyId: true } } },
  });
  if (!reports.length) return;
  const openAmount = await creditReportingOpenAmount(tx, input.tenantId, input.caseId);
  const now = new Date();
  for (const report of reports) {
    const settled = openAmount.lte(0);
    const nextStatus = settled ? CreditBureauReportStatus.SETTLED : CreditBureauReportStatus.ELIGIBILITY_REVIEW;
    const desiredActiveKey = `${input.tenantId}:${input.caseId}:${report.provider}`;
    const competingActiveReport = settled
      ? null
      : await tx.creditBureauReport.findFirst({
          where: { activeKey: desiredActiveKey, id: { not: report.id } },
          select: { id: true },
        });
    await tx.creditBureauReport.update({
      where: { id: report.id },
      data: {
        status: nextStatus,
        approvalStaleAt: now,
        settledAt: settled ? now : null,
        activeKey: settled || competingActiveReport ? null : report.activeKey ?? desiredActiveKey,
      },
    });
    await tx.creditBureauReportEvent.create({ data: {
      tenantId: input.tenantId, reportId: report.id,
      eventType: settled ? CreditBureauReportEventType.SETTLED : CreditBureauReportEventType.APPROVAL_STALE,
      statusBefore: report.status, statusAfter: nextStatus, actorMembershipId: input.actorMembershipId,
      reason: input.reasonCode, metadata: { openAmount: openAmount.toFixed(2) },
    } });
    await tx.activityEvent.create({ data: {
      tenantId: input.tenantId, caseId: input.caseId, partyId: report.case.debtorPartyId,
      actorType: input.actorMembershipId ? ActivityActorType.STAFF : ActivityActorType.SYSTEM,
      actorMembershipId: input.actorMembershipId,
      eventType: settled ? ActivityEventType.CREDIT_REPORT_SETTLED : ActivityEventType.CREDIT_REPORT_STATUS_CHANGED,
      title: settled ? "Auskunfteiprüfung als erledigt markiert" : "Freigabe muss erneut geprüft werden",
      metadata: { reportId: report.id, reasonCode: input.reasonCode, statusAfter: nextStatus },
      sourceEntityType: "CreditBureauReport", sourceEntityId: report.id,
    } });
  }
}

export async function markCreditReportsForPartyReview(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; partyId: string; reasonCode: string; actorMembershipId?: string },
) {
  const cases = await tx.creditBureauReport.findMany({
    where: { tenantId: input.tenantId, partyId: input.partyId, status: { in: [CreditBureauReportStatus.APPROVED, CreditBureauReportStatus.READY_FOR_SUBMISSION, CreditBureauReportStatus.SETTLED] } },
    select: { caseId: true }, distinct: ["caseId"],
  });
  for (const value of cases) await markCreditReportsForCaseReview(tx, { tenantId: input.tenantId, caseId: value.caseId, reasonCode: input.reasonCode, actorMembershipId: input.actorMembershipId });
}
