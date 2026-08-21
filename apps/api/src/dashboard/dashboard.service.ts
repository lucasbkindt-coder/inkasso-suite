import { Injectable } from "@nestjs/common";
import {
  CaseStatus,
  LedgerEntrySide,
  LedgerEntryStatus,
  LedgerEntryType,
  PaymentAllocationStatus,
  Prisma,
  TaskStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";

const openTaskStatuses = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS];
const costTypes = new Set<LedgerEntryType>([
  LedgerEntryType.COLLECTION_FEE,
  LedgerEntryType.EXPENSE,
  LedgerEntryType.COURT_COST,
  LedgerEntryType.ENFORCEMENT_COST,
]);

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getSummary() {
    const tenantId = await this.tenantContext.getTenantId();
    const now = new Date();
    const today = this.startOfDay(now);
    const tomorrow = this.addDays(today, 1);
    const nextWeek = this.addDays(today, 7);
    const activeCaseWhere = { tenantId, deletedAt: null, status: CaseStatus.OPEN };
    const activeTaskWhere = { tenantId, status: { in: openTaskStatuses } };

    const [activeCases, ledgerEntries, overdueCount, todayCount, overdueTasks, todayTasks, upcomingTasks, attentionCases, recentPayments] =
      await this.prisma.$transaction([
        this.prisma.case.count({ where: activeCaseWhere }),
        this.prisma.caseLedgerEntry.findMany({
          where: {
            tenantId,
            status: LedgerEntryStatus.ACTIVE,
            case: { deletedAt: null, status: CaseStatus.OPEN },
          },
          include: {
            targetAllocations: { where: { status: PaymentAllocationStatus.ACTIVE } },
            paymentAllocations: { where: { status: PaymentAllocationStatus.ACTIVE } },
          },
        }),
        this.prisma.caseTask.count({
          where: {
            ...activeTaskWhere,
            OR: [{ dueAt: { lt: today } }, { followUpAt: { lt: today } }],
          },
        }),
        this.prisma.caseTask.count({
          where: {
            ...activeTaskWhere,
            OR: [
              { dueAt: { gte: today, lt: tomorrow } },
              { followUpAt: { gte: today, lt: tomorrow } },
            ],
          },
        }),
        this.findTasks(tenantId, { OR: [{ dueAt: { lt: today } }, { followUpAt: { lt: today } }] }, 5),
        this.findTasks(
          tenantId,
          {
            OR: [
              { dueAt: { gte: today, lt: tomorrow } },
              { followUpAt: { gte: today, lt: tomorrow } },
            ],
          },
          5,
        ),
        this.findTasks(
          tenantId,
          {
            OR: [
              { dueAt: { gte: tomorrow, lt: nextWeek } },
              { followUpAt: { gte: tomorrow, lt: nextWeek } },
            ],
          },
          5,
        ),
        this.prisma.case.findMany({
          where: activeCaseWhere,
          include: {
            clientParty: { select: { displayName: true } },
            debtorParty: { select: { displayName: true } },
          },
          orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
          take: 6,
        }),
        this.prisma.caseLedgerEntry.findMany({
          where: {
            tenantId,
            type: LedgerEntryType.PAYMENT,
            status: LedgerEntryStatus.ACTIVE,
            case: { deletedAt: null },
          },
          include: {
            case: { select: { id: true, caseNumber: true, debtorParty: { select: { displayName: true } } } },
            paymentAllocations: { where: { status: PaymentAllocationStatus.ACTIVE } },
          },
          orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
          take: 5,
        }),
      ]);

    return {
      kpis: { activeCases, overdueTasks: overdueCount, todayTasks: todayCount },
      ledger: this.calculateLedgerTotals(ledgerEntries),
      tasks: { overdue: overdueTasks, today: todayTasks, upcoming: upcomingTasks },
      attentionCases,
      recentPayments: recentPayments.map((payment) => {
        const allocated = payment.paymentAllocations.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0),
        );
        return {
          id: payment.id,
          caseId: payment.case.id,
          caseNumber: payment.case.caseNumber,
          debtorName: payment.case.debtorParty.displayName,
          bookingDate: payment.bookingDate,
          amount: payment.amount.toFixed(2),
          currency: payment.currency,
          allocationPolicy: payment.allocationPolicy,
          unallocatedAmount: Prisma.Decimal.max(0, payment.amount.minus(allocated)).toFixed(2),
        };
      }),
    };
  }

  private findTasks(tenantId: string, where: Prisma.CaseTaskWhereInput, take: number) {
    return this.prisma.caseTask.findMany({
      where: { tenantId, status: { in: openTaskStatuses }, ...where },
      include: { case: { select: { id: true, caseNumber: true } } },
      orderBy: [{ dueAt: "asc" }, { followUpAt: "asc" }, { priority: "desc" }],
      take,
    });
  }

  private calculateLedgerTotals(
    entries: {
      id: string;
      side: LedgerEntrySide;
      type: LedgerEntryType;
      amount: Prisma.Decimal;
      targetAllocations: { amount: Prisma.Decimal }[];
      paymentAllocations: { amount: Prisma.Decimal }[];
    }[],
  ) {
    let principal = new Prisma.Decimal(0);
    let costs = new Prisma.Decimal(0);
    let interest = new Prisma.Decimal(0);
    let unallocatedPayments = new Prisma.Decimal(0);

    for (const entry of entries) {
      if (entry.side === LedgerEntrySide.DEBIT) {
        const allocated = entry.targetAllocations.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0),
        );
        const open = Prisma.Decimal.max(0, entry.amount.minus(allocated));
        if (entry.type === LedgerEntryType.PRINCIPAL) principal = principal.plus(open);
        else if (entry.type === LedgerEntryType.INTEREST) interest = interest.plus(open);
        else if (costTypes.has(entry.type)) costs = costs.plus(open);
      }

      if (entry.type === LedgerEntryType.PAYMENT) {
        const allocated = entry.paymentAllocations.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0),
        );
        unallocatedPayments = unallocatedPayments.plus(Prisma.Decimal.max(0, entry.amount.minus(allocated)));
      }
    }

    return {
      openPrincipal: principal.toFixed(2),
      openCosts: costs.toFixed(2),
      openInterest: interest.toFixed(2),
      totalOpen: principal.plus(costs).plus(interest).toFixed(2),
      unallocatedPayments: unallocatedPayments.toFixed(2),
    };
  }

  private startOfDay(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private addDays(value: Date, days: number) {
    const result = new Date(value);
    result.setDate(result.getDate() + days);
    return result;
  }
}
