import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ActivityEventType,
  ClaimDisputeStatus,
  ClaimStatus,
  CreditBureauEligibilityStatus,
  CreditBureauReportEventType,
  CreditBureauReportStatus,
  EnforcementTitleStatus,
  InstallmentPlanStatus,
  PartyRoleType,
  Prisma,
} from "@prisma/client";
import { ActivityService } from "../activity/activity.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { creditReportingOpenAmount } from "./credit-report-state";
import { CreateCreditBureauReportDto, QueryCreditBureauReportsDto } from "./dto";
import { configuredCreditBureauProviders } from "./providers/credit-bureau-provider";

type CheckLevel = "GREEN" | "YELLOW" | "RED";
type EligibilityCheck = { key: string; label: string; level: CheckLevel; explanation: string };

const detailInclude = {
  party: { select: { id: true, displayName: true, processingRestrictedAt: true, addresses: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] } } },
  case: { select: { id: true, caseNumber: true, status: true, clientParty: { select: { displayName: true } }, claim: true } },
  createdByMembership: { select: { user: { select: { displayName: true, email: true } } } },
  approvedByMembership: { select: { user: { select: { displayName: true, email: true } } } },
  events: { orderBy: { createdAt: "desc" }, include: { actorMembership: { select: { user: { select: { displayName: true, email: true } } } } } },
} satisfies Prisma.CreditBureauReportInclude;

@Injectable()
export class CreditReportingService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService, private readonly activity: ActivityService) {}

  async list(query: QueryCreditBureauReportsDto) {
    const tenantId = await this.tenant.getTenantId();
    const where: Prisma.CreditBureauReportWhereInput = { tenantId, status: query.status, provider: query.provider, eligibilityStatus: query.eligibility, partyId: query.partyId, caseId: query.caseId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.creditBureauReport.findMany({ where, include: detailInclude, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.creditBureauReport.count({ where }),
    ]);
    return { items: items.map((item) => this.serialize(item)), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async options() {
    const tenantId = await this.tenant.getTenantId();
    const cases = await this.prisma.case.findMany({ where: { tenantId, deletedAt: null, debtorParty: { roles: { some: { role: PartyRoleType.DEBTOR, deletedAt: null } } } }, select: { id: true, caseNumber: true, debtorParty: { select: { id: true, displayName: true } }, clientParty: { select: { displayName: true } } }, orderBy: { openedAt: "desc" } });
    return { cases, providers: configuredCreditBureauProviders.map((adapter) => adapter.provider), externalSubmissionConfigured: false };
  }

  async get(id: string) { return this.serialize(await this.find(id)); }

  async create(dto: CreateCreditBureauReportDto) {
    const tenantId = await this.tenant.getTenantId();
    const actorId = this.tenant.getStaffContext().tenantMembershipId;
    if (!configuredCreditBureauProviders.some((adapter) => adapter.provider === dto.provider)) {
      throw new BadRequestException("Dieser Auskunftei-Provider ist noch nicht konfiguriert.");
    }
    const caseRecord = await this.prisma.case.findFirst({ where: { id: dto.caseId, tenantId, deletedAt: null, debtorParty: { roles: { some: { role: PartyRoleType.DEBTOR, deletedAt: null } } } }, select: { id: true, debtorPartyId: true } });
    if (!caseRecord) throw new BadRequestException("Die Akte oder der zugehörige Schuldner wurde nicht gefunden.");
    const activeKey = `${tenantId}:${caseRecord.id}:${dto.provider}`;
    try {
      const report = await this.prisma.$transaction(async (tx) => {
        const created = await tx.creditBureauReport.create({ data: { tenantId, partyId: caseRecord.debtorPartyId, caseId: caseRecord.id, provider: dto.provider, createdByMembershipId: actorId, activeKey } });
        await tx.creditBureauReportEvent.create({ data: { tenantId, reportId: created.id, eventType: CreditBureauReportEventType.CREATED, statusAfter: created.status, actorMembershipId: actorId } });
        await this.activity.recordStaffEvent(tx, actorId, { tenantId, caseId: caseRecord.id, partyId: caseRecord.debtorPartyId, eventType: ActivityEventType.CREDIT_REPORT_CREATED, sourceEntityType: "CreditBureauReport", sourceEntityId: created.id, metadata: { provider: created.provider } });
        return created;
      });
      return this.checkEligibility(report.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Für diese Akte und diesen Provider besteht bereits eine aktive Auskunfteiprüfung.");
      throw error;
    }
  }

  async checkEligibility(id: string) {
    const report = await this.find(id);
    const evaluation = await this.evaluate(report.tenantId, report.caseId, report.partyId);
    const actorId = this.tenant.getStaffContext().tenantMembershipId;
    const status = evaluation.status === CreditBureauEligibilityStatus.ELIGIBLE ? CreditBureauReportStatus.ELIGIBLE : evaluation.status === CreditBureauEligibilityStatus.NOT_ELIGIBLE ? CreditBureauReportStatus.NOT_ELIGIBLE : CreditBureauReportStatus.ELIGIBILITY_REVIEW;
    await this.prisma.$transaction(async (tx) => {
      await tx.creditBureauReport.update({ where: { id: report.id }, data: { status, eligibilityStatus: evaluation.status, eligibilityReason: evaluation.reason, eligibilityDetails: evaluation.checks, eligibilityCheckedAt: new Date(), reportedAmount: evaluation.openAmount, currency: evaluation.currency } });
      await tx.creditBureauReportEvent.create({ data: { tenantId: report.tenantId, reportId: report.id, eventType: CreditBureauReportEventType.ELIGIBILITY_CHECKED, statusBefore: report.status, statusAfter: status, actorMembershipId: actorId, reason: evaluation.reason, metadata: { eligibilityStatus: evaluation.status, openAmount: evaluation.openAmount.toFixed(2) } } });
      await this.activity.recordStaffEvent(tx, actorId, { tenantId: report.tenantId, caseId: report.caseId, partyId: report.partyId, eventType: ActivityEventType.CREDIT_REPORT_ELIGIBILITY_CHECKED, sourceEntityType: "CreditBureauReport", sourceEntityId: report.id, metadata: { eligibilityStatus: evaluation.status, checkCount: evaluation.checks.length } });
    });
    return this.get(report.id);
  }

  async approve(id: string, reason: string) {
    const report = await this.find(id);
    const evaluation = await this.evaluate(report.tenantId, report.caseId, report.partyId);
    if (evaluation.status !== CreditBureauEligibilityStatus.ELIGIBLE) throw new ConflictException("Diese Prüfung ist aktuell nicht zur Meldung freigabefähig.");
    const actorId = this.tenant.getStaffContext().tenantMembershipId;
    const now = new Date();
    const snapshot = { approvedAt: now.toISOString(), provider: report.provider, debtor: evaluation.debtor, case: evaluation.case, claim: evaluation.claim, reportedAmount: evaluation.openAmount.toFixed(2), currency: evaluation.currency, checks: evaluation.checks, context: evaluation.context };
    const previous = report.approvalSnapshot && typeof report.approvalSnapshot === "object" && !Array.isArray(report.approvalSnapshot) && "approvals" in report.approvalSnapshot && Array.isArray(report.approvalSnapshot.approvals) ? report.approvalSnapshot.approvals : [];
    const approvalSnapshot = { version: 1, approvals: [...previous, snapshot] };
    await this.prisma.$transaction(async (tx) => {
      await tx.creditBureauReport.update({ where: { id: report.id }, data: { status: CreditBureauReportStatus.READY_FOR_SUBMISSION, eligibilityStatus: evaluation.status, eligibilityReason: evaluation.reason, eligibilityDetails: evaluation.checks, eligibilityCheckedAt: now, approvedAt: now, approvedByMembershipId: actorId, approvalReason: reason.trim(), approvalSnapshot, approvalStaleAt: null, reportedAmount: evaluation.openAmount, currency: evaluation.currency } });
      await tx.creditBureauReportEvent.create({ data: { tenantId: report.tenantId, reportId: report.id, eventType: CreditBureauReportEventType.APPROVED, statusBefore: report.status, statusAfter: CreditBureauReportStatus.READY_FOR_SUBMISSION, actorMembershipId: actorId, reason: "Staff-Freigabe dokumentiert", metadata: { reportedAmount: evaluation.openAmount.toFixed(2), provider: report.provider } } });
      await this.activity.recordStaffEvent(tx, actorId, { tenantId: report.tenantId, caseId: report.caseId, partyId: report.partyId, eventType: ActivityEventType.CREDIT_REPORT_APPROVED, sourceEntityType: "CreditBureauReport", sourceEntityId: report.id, metadata: { provider: report.provider, reportedAmount: evaluation.openAmount.toFixed(2) } });
    });
    return this.get(report.id);
  }

  async revoke(id: string, reason: string) {
    const report = await this.find(id);
    if (report.status !== CreditBureauReportStatus.APPROVED && report.status !== CreditBureauReportStatus.READY_FOR_SUBMISSION) throw new ConflictException("Für diese Prüfung besteht keine widerrufbare Freigabe.");
    const actorId = this.tenant.getStaffContext().tenantMembershipId;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.creditBureauReport.update({ where: { id: report.id }, data: { status: CreditBureauReportStatus.ELIGIBILITY_REVIEW, approvalStaleAt: now } });
      await tx.creditBureauReportEvent.create({ data: { tenantId: report.tenantId, reportId: report.id, eventType: CreditBureauReportEventType.APPROVAL_REVOKED, statusBefore: report.status, statusAfter: CreditBureauReportStatus.ELIGIBILITY_REVIEW, actorMembershipId: actorId, reason: reason.trim() } });
      await this.activity.recordStaffEvent(tx, actorId, { tenantId: report.tenantId, caseId: report.caseId, partyId: report.partyId, eventType: ActivityEventType.CREDIT_REPORT_APPROVAL_REVOKED, sourceEntityType: "CreditBureauReport", sourceEntityId: report.id, metadata: { statusAfter: CreditBureauReportStatus.ELIGIBILITY_REVIEW } });
    });
    return this.get(report.id);
  }

  async cancel(id: string, reason: string) {
    const report = await this.find(id);
    if (report.status === CreditBureauReportStatus.SETTLED || report.status === CreditBureauReportStatus.CANCELLED || report.status === CreditBureauReportStatus.REVOKED) throw new ConflictException("Diese Prüfung ist bereits abgeschlossen.");
    const actorId = this.tenant.getStaffContext().tenantMembershipId;
    await this.prisma.$transaction(async (tx) => {
      await tx.creditBureauReport.update({ where: { id: report.id }, data: { status: CreditBureauReportStatus.CANCELLED, cancelledAt: new Date(), activeKey: null } });
      await tx.creditBureauReportEvent.create({ data: { tenantId: report.tenantId, reportId: report.id, eventType: CreditBureauReportEventType.STATUS_CHANGED, statusBefore: report.status, statusAfter: CreditBureauReportStatus.CANCELLED, actorMembershipId: actorId, reason: reason.trim() } });
      await this.activity.recordStaffEvent(tx, actorId, { tenantId: report.tenantId, caseId: report.caseId, partyId: report.partyId, eventType: ActivityEventType.CREDIT_REPORT_STATUS_CHANGED, sourceEntityType: "CreditBureauReport", sourceEntityId: report.id, metadata: { statusAfter: CreditBureauReportStatus.CANCELLED } });
    });
    return this.get(report.id);
  }

  private async evaluate(tenantId: string, caseId: string, partyId: string) {
    const caseRecord = await this.prisma.case.findFirst({ where: { id: caseId, tenantId, debtorPartyId: partyId, deletedAt: null }, include: { claim: true, debtorParty: { include: { roles: { where: { deletedAt: null } }, addresses: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] } } }, clientParty: { select: { displayName: true } }, installmentPlans: { where: { status: InstallmentPlanStatus.ACTIVE }, select: { status: true, plannedInstallmentAmount: true, startDate: true } }, enforcementTitles: { where: { status: EnforcementTitleStatus.ACTIVE }, select: { type: true, status: true, titleDate: true } }, documents: { select: { type: true, status: true, generatedAt: true, sentAt: true } }, communications: { select: { channel: true, direction: true, occurredAt: true } }, } });
    if (!caseRecord || !caseRecord.debtorParty.roles.some((role) => role.role === PartyRoleType.DEBTOR)) throw new BadRequestException("Akte und Schuldner sind nicht konsistent.");
    const openAmount = await creditReportingOpenAmount(this.prisma, tenantId, caseId);
    const address = caseRecord.debtorParty.addresses.find((item) => item.isPrimary) ?? caseRecord.debtorParty.addresses[0] ?? null;
    const claim = caseRecord.claim;
    const disputed = claim?.status === ClaimStatus.DISPUTED || claim?.disputeStatus === ClaimDisputeStatus.DISPUTED || claim?.disputeStatus === ClaimDisputeStatus.PARTIALLY_DISPUTED;
    const checks: EligibilityCheck[] = [
      { key: "debtor", label: "Schuldnerzuordnung", level: "GREEN", explanation: "Aktiver Schuldner ist der Akte eindeutig zugeordnet." },
      { key: "claim", label: "Aktive Forderung", level: claim && !claim.deletedAt && claim.status !== ClaimStatus.PAID && claim.status !== ClaimStatus.CANCELLED ? "GREEN" : "RED", explanation: claim ? `Forderungsstatus: ${claim.status}` : "Keine Forderung vorhanden." },
      { key: "balance", label: "Offener Betrag", level: openAmount.gt(0) ? "GREEN" : "RED", explanation: `Offener Betrag laut Forderungskonto: ${openAmount.toFixed(2)} ${claim?.currency ?? "EUR"}.` },
      { key: "case", label: "Aktenstatus", level: caseRecord.status === "OPEN" ? "GREEN" : "RED", explanation: `Aktenstatus: ${caseRecord.status}.` },
      { key: "dispute", label: "Bestreiten der Forderung", level: disputed ? "RED" : "GREEN", explanation: disputed ? "Die Forderung ist ganz oder teilweise bestritten und erfordert eine Einzelfallprüfung." : `Dispute-Status: ${claim?.disputeStatus ?? "NONE"}.` },
      { key: "restriction", label: "Verarbeitungseinschränkung", level: caseRecord.debtorParty.processingRestrictedAt ? "RED" : "GREEN", explanation: caseRecord.debtorParty.processingRestrictedAt ? "Die Verarbeitung ist eingeschränkt; eine Freigabe ist blockiert." : "Keine Verarbeitungseinschränkung aktiv." },
      { key: "address", label: "Aktuelle Anschrift", level: address?.street && address.postalCode && address.city ? "GREEN" : "YELLOW", explanation: address ? `${address.street} ${address.houseNumber ?? ""}, ${address.postalCode} ${address.city}` : "Keine belastbare aktuelle Anschrift vorhanden." },
      { key: "reason", label: "Forderungsgrund", level: claim?.description?.trim() ? "GREEN" : "YELLOW", explanation: claim?.description?.trim() ? "Forderungsgrund ist dokumentiert." : "Forderungsgrund ist nicht ausreichend beschrieben." },
      { key: "noticeHistory", label: "Mahn- und Hinweishistorie", level: caseRecord.documents.length || caseRecord.communications.length ? "GREEN" : "YELLOW", explanation: `${caseRecord.documents.length} Dokumente und ${caseRecord.communications.length} Kommunikationsvorgänge vorhanden.` },
      { key: "installment", label: "Aktiver Ratenplan", level: caseRecord.installmentPlans.length ? "YELLOW" : "GREEN", explanation: caseRecord.installmentPlans.length ? "Ein aktiver Ratenplan muss in der Einzelfallprüfung berücksichtigt werden." : "Kein aktiver Ratenplan." },
      { key: "title", label: "Vollstreckungstitel", level: "GREEN", explanation: `${caseRecord.enforcementTitles.length} aktive Titel; ein Titel löst keine automatische Meldung aus.` },
    ];
    const hardBlock = checks.some((check) => check.level === "RED" && check.key !== "dispute");
    const reviewRequired = disputed || checks.some((check) => check.level === "YELLOW" && ["address", "reason"].includes(check.key));
    const status = hardBlock ? CreditBureauEligibilityStatus.NOT_ELIGIBLE : reviewRequired ? CreditBureauEligibilityStatus.REVIEW_REQUIRED : CreditBureauEligibilityStatus.ELIGIBLE;
    return { status, reason: status === CreditBureauEligibilityStatus.ELIGIBLE ? "Technische und fachliche Prüfkriterien erfüllt; rechtliche Einzelfallprüfung bleibt erforderlich." : status === CreditBureauEligibilityStatus.NOT_ELIGIBLE ? "Mindestens ein zwingendes Prüfkriterium ist nicht erfüllt." : "Mindestens ein Sachverhalt erfordert eine manuelle Einzelfallprüfung.", checks, openAmount, currency: claim?.currency ?? "EUR", debtor: { displayName: caseRecord.debtorParty.displayName, address: address ? { street: address.street, houseNumber: address.houseNumber, postalCode: address.postalCode, city: address.city, country: address.country } : null }, case: { caseNumber: caseRecord.caseNumber, status: caseRecord.status, client: caseRecord.clientParty.displayName }, claim: claim ? { invoiceNumber: claim.invoiceNumber, status: claim.status, disputeStatus: claim.disputeStatus, description: claim.description } : null, context: { documents: caseRecord.documents.map((item) => ({ type: item.type, status: item.status, generatedAt: item.generatedAt, sentAt: item.sentAt })), communications: caseRecord.communications, installmentPlans: caseRecord.installmentPlans.map((item) => ({ status: item.status, plannedInstallmentAmount: item.plannedInstallmentAmount.toFixed(2), startDate: item.startDate })), enforcementTitles: caseRecord.enforcementTitles } };
  }

  private async find(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const report = await this.prisma.creditBureauReport.findFirst({ where: { id, tenantId }, include: detailInclude });
    if (!report) throw new NotFoundException("Auskunfteiprüfung wurde nicht gefunden.");
    return report;
  }
  private serialize<T extends Prisma.CreditBureauReportGetPayload<{ include: typeof detailInclude }>>(report: T) { return { ...report, reportedAmount: report.reportedAmount?.toFixed(2) ?? null, externalSubmissionConfigured: false }; }
}
