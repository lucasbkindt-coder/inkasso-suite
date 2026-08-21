import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InstallmentPlanItemStatus, InstallmentPlanStatus, InstallmentRequestStatus, LedgerEntrySide, LedgerEntryStatus, LedgerEntryType, Prisma } from "@prisma/client";

import { PortalAccessService } from "../portal-auth/portal-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";

const planOpen: InstallmentPlanStatus[] = [InstallmentPlanStatus.DRAFT, InstallmentPlanStatus.ACTIVE];

@Injectable()
export class InstallmentPlansService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService, private readonly access: PortalAccessService) {}

  async createFromRequest(requestId: string) {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`installment-plan-request:${requestId}`}))`;
      const request = await tx.installmentRequest.findFirst({ where: { id: requestId, tenantId }, include: { case: { select: { id: true, debtorPartyId: true, deletedAt: true } } } });
      if (!request || request.case.deletedAt) throw new NotFoundException("Ratenanfrage wurde nicht gefunden.");
      if (request.status !== InstallmentRequestStatus.APPROVED) throw new ConflictException("Ein Ratenplan kann nur aus einer genehmigten Ratenanfrage erstellt werden.");
      const existing = await tx.installmentPlan.findUnique({ where: { sourceRequestId: request.id } });
      if (existing) throw new ConflictException("Für diese Ratenanfrage existiert bereits ein Ratenplan.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`installment-plan-case:${request.caseId}`}))`;
      const openPlan = await tx.installmentPlan.findFirst({ where: { tenantId, caseId: request.caseId, status: { in: planOpen } }, select: { id: true } });
      if (openPlan) throw new ConflictException("Für diese Akte existiert bereits ein offener Ratenplan.");
      const openAmount = await this.openAmount(tx, tenantId, request.caseId);
      if (openAmount.lte(0)) throw new BadRequestException("Für diese Akte besteht keine offene Forderung.");
      const monthly = new Prisma.Decimal(request.requestedMonthlyAmount);
      if (monthly.lte(0)) throw new BadRequestException("Die Monatsrate muss größer als null sein.");
      const count = request.numberOfInstallments ?? openAmount.dividedBy(monthly).ceil().toNumber();
      if (!Number.isSafeInteger(count) || count < 1) throw new BadRequestException("Die Anzahl der Raten ist ungültig.");
      const minimumCount = openAmount.dividedBy(monthly).ceil().toNumber();
      if (request.numberOfInstallments && count < minimumCount) throw new BadRequestException("Die gewünschte Anzahl reicht für die vereinbarte Monatsrate nicht aus.");
      const amounts = this.amounts(openAmount, monthly, count);
      const plan = await tx.installmentPlan.create({ data: { tenantId, caseId: request.caseId, debtorPartyId: request.debtorPartyId, sourceRequestId: request.id, initialOpenAmount: openAmount, plannedInstallmentAmount: monthly, startDate: request.preferredStartDate, numberOfInstallments: amounts.length, items: { create: amounts.map((amount, index) => ({ tenantId, sequenceNumber: index + 1, dueDate: this.monthDate(request.preferredStartDate, index), plannedAmount: amount })) } }, include: { items: { orderBy: { sequenceNumber: "asc" } } } });
      return this.readModel(plan, [], openAmount);
    });
  }

  async list() { const tenantId = await this.tenant.getTenantId(); const plans = await this.prisma.installmentPlan.findMany({ where: { tenantId }, include: this.include(), orderBy: { updatedAt: "desc" } }); return Promise.all(plans.map((plan) => this.hydrate(plan))); }
  async one(id: string) { const tenantId = await this.tenant.getTenantId(); const plan = await this.prisma.installmentPlan.findFirst({ where: { id, tenantId }, include: this.include() }); if (!plan) throw new NotFoundException("Ratenplan wurde nicht gefunden."); return this.hydrate(plan); }
  async activate(id: string) { return this.transition(id, "activate"); }
  async cancel(id: string) { return this.transition(id, "cancel"); }
  async default(id: string) { return this.transition(id, "default"); }

  async portal(caseId: string, previewToken?: string, sessionToken?: string) {
    const context = await this.access.resolve(previewToken, sessionToken, "DEBTOR");
    const caseRecord = await this.prisma.case.findFirst({ where: { id: caseId, tenantId: context.tenantId, debtorPartyId: context.partyId, deletedAt: null }, select: { id: true } });
    if (!caseRecord) throw new NotFoundException("Inkassoakte wurde nicht gefunden.");
    const plan = await this.prisma.installmentPlan.findFirst({ where: { tenantId: context.tenantId, caseId, debtorPartyId: context.partyId, status: { in: [...planOpen, InstallmentPlanStatus.COMPLETED] } }, include: this.include(), orderBy: { createdAt: "desc" } });
    if (!plan) return null;
    return this.hydrate(plan);
  }

  private async transition(id: string, action: "activate" | "cancel" | "default") {
    const tenantId = await this.tenant.getTenantId();
    await this.prisma.$transaction(async (tx) => {
      const plan = await tx.installmentPlan.findFirst({ where: { id, tenantId }, include: this.include() });
      if (!plan) throw new NotFoundException("Ratenplan wurde nicht gefunden.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`installment-plan:${id}`}))`;
      const now = new Date();
      if (action === "activate") {
        if (plan.status !== InstallmentPlanStatus.DRAFT) throw new ConflictException("Nur ein Entwurf kann aktiviert werden.");
        await tx.installmentPlan.update({ where: { id }, data: { status: InstallmentPlanStatus.ACTIVE, activatedAt: now } });
      } else if (action === "cancel") {
        if (!planOpen.includes(plan.status)) throw new ConflictException("Dieser Ratenplan kann nicht storniert werden.");
        await tx.installmentPlan.update({ where: { id }, data: { status: InstallmentPlanStatus.CANCELLED, cancelledAt: now } });
        await tx.installmentPlanItem.updateMany({ where: { planId: id }, data: { status: InstallmentPlanItemStatus.CANCELLED } });
      } else {
        const model = await this.hydrate(plan);
        if (plan.status !== InstallmentPlanStatus.ACTIVE || !model.items.some((item: { status: string }) => item.status === "OVERDUE")) throw new ConflictException("Ein Ratenplan kann nur bei überfälliger Rate als gescheitert markiert werden.");
        await tx.installmentPlan.update({ where: { id }, data: { status: InstallmentPlanStatus.DEFAULTED } });
      }
    });
    return this.one(id);
  }

  private include() { return { items: { orderBy: { sequenceNumber: "asc" as const } }, case: { select: { id: true, caseNumber: true, clientParty: { select: { displayName: true } }, debtorParty: { select: { displayName: true } } } } }; }
  private async hydrate(plan: any) { const payments = plan.status === InstallmentPlanStatus.ACTIVE || plan.status === InstallmentPlanStatus.COMPLETED ? await this.payments(plan.tenantId, plan.caseId, plan.activatedAt) : []; const open = await this.openAmount(this.prisma, plan.tenantId, plan.caseId); const model = this.readModel(plan, payments, open); if (plan.status === InstallmentPlanStatus.ACTIVE && model.items.every((item: any) => item.status === "PAID")) { const completedAt = new Date(); await this.prisma.installmentPlan.update({ where: { id: plan.id }, data: { status: InstallmentPlanStatus.COMPLETED, completedAt } }); model.status = "COMPLETED"; model.completedAt = completedAt; } return model; }
  private async payments(tenantId: string, caseId: string, activatedAt: Date | null) { if (!activatedAt) return []; return this.prisma.caseLedgerEntry.findMany({ where: { tenantId, caseId, type: LedgerEntryType.PAYMENT, side: LedgerEntrySide.CREDIT, status: LedgerEntryStatus.ACTIVE, createdAt: { gte: activatedAt } }, select: { amount: true, bookingDate: true, createdAt: true, id: true }, orderBy: [{ bookingDate: "asc" }, { createdAt: "asc" }, { id: "asc" }] }); }
  private async openAmount(tx: Prisma.TransactionClient | PrismaService, tenantId: string, caseId: string) { const entries = await tx.caseLedgerEntry.findMany({ where: { tenantId, caseId, status: LedgerEntryStatus.ACTIVE }, include: { targetAllocations: { where: { status: "ACTIVE" } } } }); let debit = new Prisma.Decimal(0); let credit = new Prisma.Decimal(0); for (const entry of entries) { if (entry.side === LedgerEntrySide.DEBIT) debit = debit.plus(entry.amount); else credit = credit.plus(entry.amount); } return Prisma.Decimal.max(0, debit.minus(credit)); }
  private readModel(plan: any, payments: { amount: Prisma.Decimal }[], currentOpen: Prisma.Decimal) { let received = payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)); const today = new Date(); const items = plan.items.map((item: any) => { const credited = plan.status === InstallmentPlanStatus.CANCELLED ? new Prisma.Decimal(0) : Prisma.Decimal.min(item.plannedAmount, received); received = Prisma.Decimal.max(0, received.minus(item.plannedAmount)); const remaining = item.plannedAmount.minus(credited); const status = plan.status === InstallmentPlanStatus.CANCELLED ? "CANCELLED" : remaining.isZero() ? "PAID" : credited.gt(0) ? "PARTIALLY_PAID" : plan.status === InstallmentPlanStatus.ACTIVE && item.dueDate < today ? "OVERDUE" : "OPEN"; return { id: item.id, sequenceNumber: item.sequenceNumber, dueDate: item.dueDate, plannedAmount: item.plannedAmount.toFixed(2), creditedAmount: credited.toFixed(2), remainingAmount: remaining.toFixed(2), status }; }); const next = items.find((item: any) => item.status !== "PAID" && item.status !== "CANCELLED") ?? null; return { id: plan.id, status: plan.status, initialOpenAmount: plan.initialOpenAmount.toFixed(2), plannedInstallmentAmount: plan.plannedInstallmentAmount.toFixed(2), startDate: plan.startDate, numberOfInstallments: plan.numberOfInstallments, activatedAt: plan.activatedAt, completedAt: plan.completedAt, cancelledAt: plan.cancelledAt, case: plan.case, currentCaseBalance: currentOpen.toFixed(2), planCaseDifference: currentOpen.minus(plan.initialOpenAmount).toFixed(2), nextItem: next, items }; }
  private amounts(total: Prisma.Decimal, monthly: Prisma.Decimal, count: number) { const result: Prisma.Decimal[] = []; let rest = total; for (let i = 0; i < count && rest.gt(0); i += 1) { const amount = Prisma.Decimal.min(monthly, rest); result.push(amount); rest = rest.minus(amount); } return result; }
  private monthDate(start: Date, offset: number) { const day = start.getUTCDate(); const year = start.getUTCFullYear(); const month = start.getUTCMonth() + offset; const targetYear = year + Math.floor(month / 12); const targetMonth = ((month % 12) + 12) % 12; const end = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(); return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, end))); }
}
