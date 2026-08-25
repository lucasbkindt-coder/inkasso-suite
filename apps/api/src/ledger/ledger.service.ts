import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AllocationPolicy,
  ActivityEventType,
  CaseCostCalculationStatus,
  LedgerEntrySide,
  LedgerEntryStatus,
  LedgerEntryType,
  Prisma,
  PaymentAllocationStatus,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { ActivityService } from "../activity/activity.service";
import { CreateLedgerEntryDto } from "./dto/create-ledger-entry.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";

const debitTypes = new Set<LedgerEntryType>([
  LedgerEntryType.INTEREST,
  LedgerEntryType.COLLECTION_FEE,
  LedgerEntryType.EXPENSE,
  LedgerEntryType.COURT_COST,
  LedgerEntryType.ENFORCEMENT_COST,
]);
const creditTypes = new Set<LedgerEntryType>([
  LedgerEntryType.PAYMENT,
  LedgerEntryType.CREDIT_NOTE,
]);
const manualTypes = new Set<LedgerEntryType>([
  ...debitTypes,
  ...creditTypes,
  LedgerEntryType.CORRECTION,
  LedgerEntryType.OTHER,
]);
const costTypes = new Set<LedgerEntryType>([
  LedgerEntryType.COLLECTION_FEE,
  LedgerEntryType.EXPENSE,
  LedgerEntryType.COURT_COST,
  LedgerEntryType.ENFORCEMENT_COST,
]);
const allocatableTypes = new Set<LedgerEntryType>([
  ...costTypes,
  LedgerEntryType.INTEREST,
  LedgerEntryType.PRINCIPAL,
]);
export type PrincipalBalancePeriod = { from: Date; to: Date; principalBalance: Prisma.Decimal };

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly activity: ActivityService,
  ) {}

  async findAll(caseId: string) {
    const tenantId = await this.tenantContext.getTenantId();
    await this.assertCase(caseId, tenantId);
    const entries = await this.prisma.caseLedgerEntry.findMany({
      where: { caseId, tenantId },
      orderBy: [{ bookingDate: "asc" }, { createdAt: "asc" }],
      include: {
        paymentAllocations: {
          where: { status: PaymentAllocationStatus.ACTIVE },
          orderBy: { allocationOrder: "asc" },
          include: { targetEntry: { select: { description: true, type: true } } },
        },
        targetAllocations: { where: { status: PaymentAllocationStatus.ACTIVE } },
      },
    });
    const allocationByTarget = new Map<string, Prisma.Decimal>();
    for (const entry of entries)
      for (const allocation of entry.targetAllocations)
        allocationByTarget.set(
          entry.id,
          (allocationByTarget.get(entry.id) ?? new Prisma.Decimal(0)).plus(allocation.amount),
        );
    const items = entries.map(({ targetAllocations, ...entry }) => ({
      ...entry,
      allocatedAmount: (allocationByTarget.get(entry.id) ?? new Prisma.Decimal(0)).toFixed(2),
      remainingAmount:
        entry.side === LedgerEntrySide.DEBIT && entry.status === LedgerEntryStatus.ACTIVE
          ? Prisma.Decimal.max(
              new Prisma.Decimal(0),
              entry.amount.minus(allocationByTarget.get(entry.id) ?? 0),
            ).toFixed(2)
          : null,
    }));
    return { items, totals: this.calculateTotals(entries, allocationByTarget) };
  }

  async findPayments(caseId: string) {
    const tenantId = await this.tenantContext.getTenantId();
    await this.assertCase(caseId, tenantId);
    const payments = await this.prisma.caseLedgerEntry.findMany({
      where: { tenantId, caseId, type: LedgerEntryType.PAYMENT },
      orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
      include: {
        paymentAllocations: {
          orderBy: { allocationOrder: "asc" },
          include: { targetEntry: { select: { type: true, description: true } } },
        },
      },
    });
    return {
      items: payments.map((payment) => {
        const active = payment.paymentAllocations.filter(
          (allocation) => allocation.status === PaymentAllocationStatus.ACTIVE,
        );
        const allocatedAmount = active.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0),
        );
        return {
          ...payment,
          allocatedAmount: allocatedAmount.toFixed(2),
          unallocatedAmount:
            payment.status === LedgerEntryStatus.ACTIVE
              ? Prisma.Decimal.max(0, payment.amount.minus(allocatedAmount)).toFixed(2)
              : "0.00",
          allocations: payment.paymentAllocations.map((allocation) => ({
            ...allocation,
            type: allocation.targetEntry.type,
            description: allocation.targetEntry.description,
          })),
        };
      }),
    };
  }

  async applyPayment(caseId: string, dto: CreatePaymentDto) {
    const tenantId = await this.tenantContext.getTenantId();
    await this.assertCase(caseId, tenantId);
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0))
      throw new BadRequestException("Der Zahlungsbetrag muss größer als null sein.");
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.caseLedgerEntry.create({
        data: {
          tenantId,
          caseId,
          side: LedgerEntrySide.CREDIT,
          type: LedgerEntryType.PAYMENT,
          amount,
          currency: dto.currency.toUpperCase(),
          bookingDate: new Date(dto.bookingDate),
          valueDate: dto.valueDate ? new Date(dto.valueDate) : undefined,
          description: dto.description?.trim() || "Zahlungseingang",
          externalReference: dto.reference?.trim(),
          source: "payment-allocation",
          allocationPolicy: dto.allocationPolicy,
        },
      });
      const caseRecord = await tx.case.findFirstOrThrow({ where: { id: caseId, tenantId }, select: { debtorPartyId: true } });
      await this.activity.recordStaffEvent(tx, this.tenantContext.getStaffContext().tenantMembershipId, {
        tenantId,
        caseId,
        partyId: caseRecord.debtorPartyId,
        eventType: ActivityEventType.PAYMENT_CREATED,
        description: `Zahlung über ${amount.toFixed(2)} ${dto.currency.toUpperCase()} wurde erfasst.`,
        metadata: { paymentId: payment.id, amount: amount.toFixed(2), bookingDate: dto.bookingDate },
        sourceEntityType: "CaseLedgerEntry",
        sourceEntityId: payment.id,
      });
      const targets = await tx.caseLedgerEntry.findMany({
        where: {
          tenantId,
          caseId,
          status: LedgerEntryStatus.ACTIVE,
          side: LedgerEntrySide.DEBIT,
          type: { in: [...allocatableTypes] },
        },
        orderBy: [{ bookingDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        include: { targetAllocations: { where: { status: PaymentAllocationStatus.ACTIVE } } },
      });
      let remaining = amount;
      let allocationOrder = 0;
      const allocations = [] as {
        targetEntryId: string;
        amount: Prisma.Decimal;
        policy: AllocationPolicy;
        allocationOrder: number;
      }[];
      const selected =
        dto.allocationPolicy === AllocationPolicy.CUSTOM ? (dto.allocations ?? []) : undefined;
      if (selected) {
        const selectedTargetIds = new Set<string>();
        for (const item of selected) {
          if (selectedTargetIds.has(item.targetEntryId))
            throw new BadRequestException("Eine Zielbuchung darf nur einmal zugeordnet werden.");
          selectedTargetIds.add(item.targetEntryId);
          const target = targets.find((entry) => entry.id === item.targetEntryId);
          if (!target) throw new BadRequestException("Die Zielbuchung ist nicht tilgungsfähig.");
          const requested = new Prisma.Decimal(item.amount);
          if (requested.lte(0))
            throw new BadRequestException("Zuordnungsbeträge müssen größer als null sein.");
          const allocated = target.targetAllocations.reduce(
            (sum, allocation) => sum.plus(allocation.amount),
            new Prisma.Decimal(0),
          );
          const open = target.amount.minus(allocated);
          if (requested.gt(open))
            throw new BadRequestException("Der Zuordnungsbetrag überschreitet den offenen Betrag.");
          if (requested.gt(remaining))
            throw new BadRequestException("Die Summe der Zuordnungen überschreitet die Zahlung.");
          allocationOrder += 1;
          allocations.push({
            targetEntryId: target.id,
            amount: requested,
            policy: dto.allocationPolicy,
            allocationOrder,
          });
          remaining = remaining.minus(requested);
        }
      }
      for (const target of selected ? [] : this.orderBgb367(targets)) {
        if (remaining.lte(0)) break;
        const allocated = target.targetAllocations.reduce(
          (sum, item) => sum.plus(item.amount),
          new Prisma.Decimal(0),
        );
        const open = target.amount.minus(allocated);
        if (open.lte(0)) continue;
        const applied = Prisma.Decimal.min(remaining, open);
        allocationOrder += 1;
        allocations.push({
          targetEntryId: target.id,
          amount: applied,
          policy: dto.allocationPolicy,
          allocationOrder,
        });
        remaining = remaining.minus(applied);
      }
      if (allocations.length)
        await tx.paymentAllocation.createMany({
          data: allocations.map((allocation) => ({
            ...allocation,
            tenantId,
            caseId,
            paymentEntryId: payment.id,
          })),
        });
      const ledgerEntries = await tx.caseLedgerEntry.findMany({
        where: { tenantId, caseId, status: LedgerEntryStatus.ACTIVE },
      });
      const allAllocations = await tx.paymentAllocation.findMany({
        where: { tenantId, caseId, status: PaymentAllocationStatus.ACTIVE },
      });
      return {
        payment,
        allocations: allocations.map((allocation) => {
          const target = targets.find((entry) => entry.id === allocation.targetEntryId);
          return {
            ...allocation,
            targetType: target?.type,
            targetDescription: target?.description,
          };
        }),
        unallocatedAmount: remaining.toFixed(2),
        balances: this.calculateTotals(ledgerEntries, this.allocationMap(allAllocations)),
      };
    });
  }

  async create(caseId: string, dto: CreateLedgerEntryDto) {
    const tenantId = await this.tenantContext.getTenantId();
    await this.assertCase(caseId, tenantId);
    if (!manualTypes.has(dto.type) || dto.type === LedgerEntryType.PRINCIPAL)
      throw new BadRequestException(
        "Hauptforderungen werden ausschließlich bei der Aktenanlage gebucht.",
      );
    if (dto.type === LedgerEntryType.PAYMENT)
      throw new BadRequestException("Zahlungen werden über die Zahlungsanrechnung erfasst.");
    if (dto.createdByMembershipId) await this.assertMembership(dto.createdByMembershipId, tenantId);
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.isNegative() || amount.isZero())
      throw new BadRequestException("Der Buchungsbetrag muss größer als null sein.");
    const side = this.resolveSide(dto.type, dto.side);
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.caseLedgerEntry.create({
      data: {
        tenantId,
        caseId,
        side,
        type: dto.type,
        amount,
        currency: dto.currency.toUpperCase(),
        bookingDate: new Date(dto.bookingDate),
        valueDate: dto.valueDate ? new Date(dto.valueDate) : undefined,
        description: dto.description.trim(),
        externalReference: dto.externalReference?.trim(),
        source: dto.source?.trim() ?? "manual",
        createdByMembershipId: dto.createdByMembershipId,
      },
      });
      if (costTypes.has(entry.type)) {
        const caseRecord = await tx.case.findFirstOrThrow({ where: { id: caseId, tenantId }, select: { debtorPartyId: true } });
        await this.activity.recordStaffEvent(tx, this.tenantContext.getStaffContext().tenantMembershipId, {
          tenantId,
          caseId,
          partyId: caseRecord.debtorPartyId,
          eventType: ActivityEventType.COST_CREATED,
          description: `Kosten über ${entry.amount.toFixed(2)} ${entry.currency} wurden gebucht.`,
          metadata: { costId: entry.id, amount: entry.amount.toFixed(2), type: entry.type, description: entry.description },
          sourceEntityType: "CaseLedgerEntry",
          sourceEntityId: entry.id,
        });
      }
      return entry;
    });
  }

  async reverse(caseId: string, entryId: string) {
    const tenantId = await this.tenantContext.getTenantId();
    await this.assertCase(caseId, tenantId);
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.caseLedgerEntry.findFirst({
        where: { id: entryId, caseId, tenantId },
        include: { reversal: true },
      });
      if (!entry) throw new NotFoundException("Buchung wurde nicht gefunden.");
      if (entry.status === LedgerEntryStatus.REVERSED || entry.reversal || entry.reversedEntryId)
        throw new ConflictException("Die Buchung wurde bereits storniert.");

      await tx.caseLedgerEntry.update({
        where: { id: entry.id },
        data: { status: LedgerEntryStatus.REVERSED },
      });
      if (entry.type === LedgerEntryType.PAYMENT) {
        await tx.paymentAllocation.updateMany({
          where: { paymentEntryId: entry.id, status: PaymentAllocationStatus.ACTIVE },
          data: { status: PaymentAllocationStatus.REVERSED, reversedAt: new Date() },
        });
      }
      const reversal = await tx.caseLedgerEntry.create({
        data: {
          tenantId,
          caseId,
          side:
            entry.side === LedgerEntrySide.DEBIT ? LedgerEntrySide.CREDIT : LedgerEntrySide.DEBIT,
          type: LedgerEntryType.CORRECTION,
          amount: entry.amount,
          currency: entry.currency,
          bookingDate: new Date(),
          valueDate: entry.valueDate,
          description: `Storno: ${entry.description}`,
          externalReference: entry.externalReference,
          source: "reversal",
          reversedEntryId: entry.id,
          createdByMembershipId: entry.createdByMembershipId,
        },
      });
      if (entry.type === LedgerEntryType.PAYMENT) {
        const caseRecord = await tx.case.findFirstOrThrow({ where: { id: caseId, tenantId }, select: { debtorPartyId: true } });
        await this.activity.recordStaffEvent(tx, this.tenantContext.getStaffContext().tenantMembershipId, {
          tenantId,
          caseId,
          partyId: caseRecord.debtorPartyId,
          eventType: ActivityEventType.PAYMENT_REVERSED,
          description: `Zahlung über ${entry.amount.toFixed(2)} ${entry.currency} wurde storniert.`,
          metadata: { paymentId: entry.id, amount: entry.amount.toFixed(2) },
          sourceEntityType: "CaseLedgerEntry",
          sourceEntityId: entry.id,
        });
      }
      if (entry.costCalculationId) {
        const activeEntries = await tx.caseLedgerEntry.count({
          where: { costCalculationId: entry.costCalculationId, status: LedgerEntryStatus.ACTIVE },
        });
        if (activeEntries === 0) {
          await tx.caseCostCalculation.updateMany({
            where: { id: entry.costCalculationId, status: CaseCostCalculationStatus.APPLIED },
            data: { status: CaseCostCalculationStatus.REVERSED, reversedAt: new Date() },
          });
        }
      }
      return reversal;
    });
  }

  private async assertCase(caseId: string, tenantId: string) {
    const caseRecord = await this.prisma.case.findFirst({
      where: { id: caseId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!caseRecord) throw new NotFoundException("Akte wurde nicht gefunden.");
  }

  private async assertMembership(membershipId: string, tenantId: string) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!membership)
      throw new BadRequestException("Mitgliedschaft gehört nicht zum aktiven Mandanten.");
  }

  private resolveSide(type: LedgerEntryType, requestedSide?: LedgerEntrySide) {
    if (creditTypes.has(type)) {
      if (requestedSide && requestedSide !== LedgerEntrySide.CREDIT)
        throw new BadRequestException("Zahlungen und Gutschriften müssen im Haben gebucht werden.");
      return LedgerEntrySide.CREDIT;
    }
    if (debitTypes.has(type)) {
      if (requestedSide && requestedSide !== LedgerEntrySide.DEBIT)
        throw new BadRequestException("Kosten- und Zinspositionen müssen im Soll gebucht werden.");
      return LedgerEntrySide.DEBIT;
    }
    if (!requestedSide)
      throw new BadRequestException(
        "Für Korrektur und Sonstiges muss Soll oder Haben gewählt werden.",
      );
    return requestedSide;
  }

  async getPrincipalBalancePeriods(
    caseId: string,
    from: Date,
    to: Date,
  ): Promise<PrincipalBalancePeriod[]> {
    const tenantId = await this.tenantContext.getTenantId();
    await this.assertCase(caseId, tenantId);
    if (to < from) throw new BadRequestException("Ungültiger Zeitraum.");
    const [entries, allocations] = await Promise.all([
      this.prisma.caseLedgerEntry.findMany({
        where: {
          tenantId,
          caseId,
          status: LedgerEntryStatus.ACTIVE,
          type: LedgerEntryType.PRINCIPAL,
          side: LedgerEntrySide.DEBIT,
        },
        orderBy: [{ bookingDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.paymentAllocation.findMany({
        where: {
          tenantId,
          caseId,
          status: PaymentAllocationStatus.ACTIVE,
          targetEntry: { type: LedgerEntryType.PRINCIPAL, status: LedgerEntryStatus.ACTIVE },
        },
        include: { paymentEntry: { select: { bookingDate: true, status: true } } },
        orderBy: { paymentEntry: { bookingDate: "asc" } },
      }),
    ]);
    let balance = entries
      .filter((entry) => entry.bookingDate < from)
      .reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0));
    for (const allocation of allocations)
      if (
        allocation.paymentEntry.status === LedgerEntryStatus.ACTIVE &&
        allocation.paymentEntry.bookingDate < from
      )
        balance = balance.minus(allocation.amount);
    const eventDates = new Set<string>();
    for (const entry of entries)
      if (entry.bookingDate >= from && entry.bookingDate <= to)
        eventDates.add(this.dateKey(entry.bookingDate));
    for (const allocation of allocations)
      if (
        allocation.paymentEntry.status === LedgerEntryStatus.ACTIVE &&
        allocation.paymentEntry.bookingDate >= from &&
        allocation.paymentEntry.bookingDate <= to
      )
        eventDates.add(this.dateKey(allocation.paymentEntry.bookingDate));
    const dates = [...eventDates].sort().map((key) => new Date(`${key}T00:00:00.000Z`));
    const result: PrincipalBalancePeriod[] = [];
    let cursor = from;
    for (const date of dates) {
      if (cursor < date)
        result.push({ from: cursor, to: this.previousDay(date), principalBalance: balance });
      for (const entry of entries)
        if (this.dateKey(entry.bookingDate) === this.dateKey(date))
          balance = balance.plus(entry.amount);
      for (const allocation of allocations)
        if (
          allocation.paymentEntry.status === LedgerEntryStatus.ACTIVE &&
          this.dateKey(allocation.paymentEntry.bookingDate) === this.dateKey(date)
        )
          balance = balance.minus(allocation.amount);
      cursor = date;
    }
    if (cursor <= to)
      result.push({ from: cursor, to, principalBalance: Prisma.Decimal.max(balance, 0) });
    return result.filter((period) => period.principalBalance.gt(0));
  }

  private orderBgb367<
    T extends { type: LedgerEntryType; bookingDate: Date; createdAt: Date; id: string },
  >(entries: T[]) {
    const rank = (type: LedgerEntryType) =>
      costTypes.has(type) ? 0 : type === LedgerEntryType.INTEREST ? 1 : 2;
    return [...entries].sort(
      (a, b) =>
        rank(a.type) - rank(b.type) ||
        a.bookingDate.getTime() - b.bookingDate.getTime() ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  }

  private allocationMap(allocations: { targetEntryId: string; amount: Prisma.Decimal }[]) {
    return allocations.reduce(
      (map, allocation) =>
        map.set(
          allocation.targetEntryId,
          (map.get(allocation.targetEntryId) ?? new Prisma.Decimal(0)).plus(allocation.amount),
        ),
      new Map<string, Prisma.Decimal>(),
    );
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }
  private previousDay(value: Date) {
    const result = new Date(value);
    result.setUTCDate(result.getUTCDate() - 1);
    return result;
  }

  private calculateTotals(
    entries: {
      side: LedgerEntrySide;
      amount: Prisma.Decimal;
      type?: LedgerEntryType;
      status?: LedgerEntryStatus;
      id?: string;
      paymentAllocations?: { amount: Prisma.Decimal }[];
    }[],
    allocations = new Map<string, Prisma.Decimal>(),
  ) {
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    let costs = new Prisma.Decimal(0);
    let interest = new Prisma.Decimal(0);
    let principal = new Prisma.Decimal(0);
    let unallocatedPayments = new Prisma.Decimal(0);
    for (const entry of entries) {
      if (entry.side === LedgerEntrySide.DEBIT) totalDebit = totalDebit.plus(entry.amount);
      else totalCredit = totalCredit.plus(entry.amount);
      if (
        entry.side === LedgerEntrySide.DEBIT &&
        entry.status !== LedgerEntryStatus.REVERSED &&
        entry.id &&
        entry.type
      ) {
        const open = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          entry.amount.minus(allocations.get(entry.id) ?? 0),
        );
        if (costTypes.has(entry.type)) costs = costs.plus(open);
        else if (entry.type === LedgerEntryType.INTEREST) interest = interest.plus(open);
        else if (entry.type === LedgerEntryType.PRINCIPAL) principal = principal.plus(open);
      }
      if (
        entry.type === LedgerEntryType.PAYMENT &&
        entry.status !== LedgerEntryStatus.REVERSED &&
        entry.paymentAllocations
      ) {
        const allocated = entry.paymentAllocations.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0),
        );
        unallocatedPayments = unallocatedPayments.plus(
          Prisma.Decimal.max(0, entry.amount.minus(allocated)),
        );
      }
    }
    return {
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      balance: totalDebit.minus(totalCredit).toFixed(2),
      openCosts: costs.toFixed(2),
      openInterest: interest.toFixed(2),
      openPrincipal: principal.toFixed(2),
      totalOpen: costs.plus(interest).plus(principal).toFixed(2),
      unallocatedPayments: unallocatedPayments.toFixed(2),
    };
  }
}
