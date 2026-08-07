import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LedgerEntrySide, LedgerEntryStatus, LedgerEntryType, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateLedgerEntryDto } from "./dto/create-ledger-entry.dto";

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

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(caseId: string) {
    const tenantId = await this.tenantContext.getTenantId();
    await this.assertCase(caseId, tenantId);
    const entries = await this.prisma.caseLedgerEntry.findMany({
      where: { caseId, tenantId },
      orderBy: [{ bookingDate: "asc" }, { createdAt: "asc" }],
    });
    return { items: entries, totals: this.calculateTotals(entries) };
  }

  async create(caseId: string, dto: CreateLedgerEntryDto) {
    const tenantId = await this.tenantContext.getTenantId();
    await this.assertCase(caseId, tenantId);
    if (!manualTypes.has(dto.type) || dto.type === LedgerEntryType.PRINCIPAL)
      throw new BadRequestException(
        "Hauptforderungen werden ausschließlich bei der Aktenanlage gebucht.",
      );
    if (dto.createdByMembershipId) await this.assertMembership(dto.createdByMembershipId, tenantId);
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.isNegative() || amount.isZero())
      throw new BadRequestException("Der Buchungsbetrag muss größer als null sein.");
    const side = this.resolveSide(dto.type, dto.side);
    return this.prisma.caseLedgerEntry.create({
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
      return tx.caseLedgerEntry.create({
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

  private calculateTotals(entries: { side: LedgerEntrySide; amount: Prisma.Decimal }[]) {
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const entry of entries) {
      if (entry.side === LedgerEntrySide.DEBIT) totalDebit = totalDebit.plus(entry.amount);
      else totalCredit = totalCredit.plus(entry.amount);
    }
    return {
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      balance: totalDebit.minus(totalCredit).toFixed(2),
    };
  }
}
