import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActivityEventType,
  AllocationPolicy,
  BankImportStatus,
  BankTransactionDirection,
  BankTransactionStatus,
  CaseStatus,
  LedgerEntrySide,
  LedgerEntryStatus,
  PaymentAllocationStatus,
  Prisma,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { ActivityService } from "../activity/activity.service";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { BankImportStorage } from "./bank-import-storage";
import type { BankCaseSearchDto, BankTransactionQueryDto } from "./dto";
import { BankFileParserService } from "./parsers/bank-file-parser.service";
import type { ParsedBankTransaction } from "./parsers/bank-file-parser";

type UploadFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

const detailInclude = {
  bankImport: { select: { id: true, fileName: true, fileFormat: true, importedAt: true } },
  matchedCase: {
    select: {
      id: true,
      caseNumber: true,
      status: true,
      clientParty: { select: { displayName: true } },
      debtorParty: { select: { displayName: true } },
    },
  },
  matchedParty: { select: { id: true, displayName: true } },
  payment: { select: { id: true, status: true, amount: true, currency: true, bookingDate: true } },
  reviewedBy: { select: { user: { select: { displayName: true, email: true } } } },
} satisfies Prisma.BankTransactionInclude;
type TransactionDetail = Prisma.BankTransactionGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class BankImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly parser: BankFileParserService,
    private readonly storage: BankImportStorage,
    private readonly ledger: LedgerService,
    private readonly activity: ActivityService,
  ) {}

  async upload(file?: UploadFile) {
    if (!file) throw new BadRequestException("Bitte eine CAMT-Datei auswählen.");
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException("Die Bankdatei darf maximal 5 MB groß sein.");
    if (!/\.xml$/i.test(file.originalname))
      throw new BadRequestException("Unterstützt werden ausschließlich CAMT-XML-Dateien.");
    const tenantId = await this.tenant.getTenantId();
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    const fileHash = this.hash(file.buffer);
    const existing = await this.prisma.bankImport.findUnique({
      where: { tenantId_fileHash: { tenantId, fileHash } },
      select: { id: true },
    });
    if (existing) throw new ConflictException("Diese Bankdatei wurde bereits importiert.");
    const parsed = this.parser.parse(file.buffer);
    const storageKey = await this.storage.save(file.buffer);
    let bankImport;
    try {
      bankImport = await this.prisma.$transaction(async (tx) => {
        const created = await tx.bankImport.create({
          data: {
            tenantId,
            fileName: this.safeFileName(file.originalname),
            fileFormat: parsed.format,
            fileHash,
            storageKey,
            mimeType: "application/xml",
            fileSize: file.size,
            importedByMembershipId: actorMembershipId,
          },
        });
        await this.activity.recordStaffEvent(tx, actorMembershipId, {
          tenantId,
          eventType: ActivityEventType.BANK_IMPORT_CREATED,
          metadata: {
            bankImportId: created.id,
            fileFormat: created.fileFormat,
            fileHash: created.fileHash,
          },
          sourceEntityType: "BankImport",
          sourceEntityId: created.id,
        });
        return created;
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      if (this.isUnique(error))
        throw new ConflictException("Diese Bankdatei wurde bereits importiert.");
      throw error;
    }

    for (const transaction of parsed.transactions)
      await this.ingest(bankImport.id, tenantId, actorMembershipId, transaction);
    await this.refreshSummary(bankImport.id, tenantId);
    return this.getImport(bankImport.id);
  }

  async listImports() {
    const tenantId = await this.tenant.getTenantId();
    const items = await this.prisma.bankImport.findMany({
      where: { tenantId },
      include: { importedBy: { select: { user: { select: { displayName: true, email: true } } } } },
      orderBy: [{ importedAt: "desc" }, { id: "desc" }],
    });
    return items.map((item) => ({ ...item, storageKey: undefined }));
  }

  async getImport(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const item = await this.prisma.bankImport.findFirst({
      where: { id, tenantId },
      include: { importedBy: { select: { user: { select: { displayName: true, email: true } } } } },
    });
    if (!item) throw new NotFoundException("Bankimport wurde nicht gefunden.");
    const { storageKey: _storageKey, ...safe } = item;
    return safe;
  }

  async listTransactions(query: BankTransactionQueryDto) {
    const tenantId = await this.tenant.getTenantId();
    const items = await this.prisma.bankTransaction.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.importId ? { bankImportId: query.importId } : {}),
        ...(query.bookingFrom || query.bookingTo
          ? {
              bookingDate: {
                ...(query.bookingFrom ? { gte: new Date(query.bookingFrom) } : {}),
                ...(query.bookingTo ? { lte: new Date(query.bookingTo) } : {}),
              },
            }
          : {}),
      },
      include: detailInclude,
      orderBy: [{ bookingDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    return items.map((item) => this.serializeTransaction(item));
  }

  async getTransaction(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const item = await this.prisma.bankTransaction.findFirst({
      where: { id, tenantId },
      include: detailInclude,
    });
    if (!item) throw new NotFoundException("Bankbuchung wurde nicht gefunden.");
    return { ...this.serializeTransaction(item), candidates: await this.candidates(item) };
  }

  async searchCases(dto: BankCaseSearchDto) {
    const tenantId = await this.tenant.getTenantId();
    const cases = await this.prisma.case.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: CaseStatus.OPEN,
        OR: [
          { caseNumber: { contains: dto.query, mode: "insensitive" } },
          { debtorParty: { displayName: { contains: dto.query, mode: "insensitive" } } },
        ],
      },
      include: {
        clientParty: { select: { displayName: true } },
        debtorParty: { select: { displayName: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return Promise.all(cases.map((item) => this.caseCandidate(item)));
  }

  async book(id: string, caseId: string) {
    const tenantId = await this.tenant.getTenantId();
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bank-transaction:${id}`}))`;
      const item = await tx.bankTransaction.findFirst({ where: { id, tenantId } });
      if (!item) throw new NotFoundException("Bankbuchung wurde nicht gefunden.");
      if (item.status === BankTransactionStatus.BOOKED || item.paymentId)
        throw new ConflictException("Diese Bankbuchung wurde bereits als Zahlung gebucht.");
      if (
        item.status !== BankTransactionStatus.REVIEW_REQUIRED &&
        item.status !== BankTransactionStatus.MATCHED
      )
        throw new ConflictException("Diese Bankbuchung kann nicht manuell zugeordnet werden.");
      this.assertBookableTransaction(item);
      const caseRecord = await tx.case.findFirst({
        where: { id: caseId, tenantId, deletedAt: null, status: CaseStatus.OPEN },
        select: { id: true, debtorPartyId: true },
      });
      if (!caseRecord)
        throw new NotFoundException(
          "Die ausgewählte Inkassoakte wurde nicht gefunden oder ist nicht buchbar.",
        );
      await this.activity.recordStaffEvent(tx, actorMembershipId, {
        tenantId,
        caseId,
        partyId: caseRecord.debtorPartyId,
        eventType: ActivityEventType.BANK_TRANSACTION_MANUALLY_MATCHED,
        metadata: { bankTransactionId: item.id },
        sourceEntityType: "BankTransaction",
        sourceEntityId: item.id,
      });
      const result = await this.bookPayment(tx, item, caseRecord, actorMembershipId);
      await this.refreshSummaryWithClient(tx, item.bankImportId, tenantId);
      return result;
    });
  }

  async ignore(id: string, reason: string) {
    const tenantId = await this.tenant.getTenantId();
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bank-transaction:${id}`}))`;
      const item = await tx.bankTransaction.findFirst({ where: { id, tenantId } });
      if (!item) throw new NotFoundException("Bankbuchung wurde nicht gefunden.");
      if (item.paymentId || item.status === BankTransactionStatus.BOOKED)
        throw new ConflictException(
          "Eine bereits gebuchte Zahlung muss über die Zahlungsstornierung korrigiert werden.",
        );
      if (
        item.status === BankTransactionStatus.DUPLICATE ||
        item.status === BankTransactionStatus.IGNORED
      )
        throw new ConflictException("Diese Bankbuchung kann nicht ignoriert werden.");
      const updated = await tx.bankTransaction.update({
        where: { id: item.id },
        data: {
          status: BankTransactionStatus.IGNORED,
          ignoreReason: reason.trim(),
          reviewedByMembershipId: actorMembershipId,
          reviewedAt: new Date(),
        },
      });
      await this.activity.recordStaffEvent(tx, actorMembershipId, {
        tenantId,
        eventType: ActivityEventType.BANK_TRANSACTION_IGNORED,
        metadata: { bankTransactionId: item.id, reasonRecorded: true },
        sourceEntityType: "BankTransaction",
        sourceEntityId: item.id,
      });
      await this.refreshSummaryWithClient(tx, item.bankImportId, tenantId);
      return updated;
    });
  }

  async download(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const item = await this.prisma.bankImport.findFirst({
      where: { id, tenantId },
      select: { fileName: true, mimeType: true, storageKey: true },
    });
    if (!item) throw new NotFoundException("Bankimport wurde nicht gefunden.");
    return {
      filename: this.safeFileName(item.fileName),
      mimeType: item.mimeType,
      buffer: await this.storage.read(item.storageKey),
    };
  }

  private async ingest(
    bankImportId: string,
    tenantId: string,
    actorMembershipId: string,
    value: ParsedBankTransaction,
  ) {
    const transactionKey = this.transactionKey(value);
    const data = {
      tenantId,
      bankImportId,
      externalTransactionId: value.externalTransactionId,
      bookingDate: value.bookingDate,
      valueDate: value.valueDate,
      amount: new Prisma.Decimal(value.amount),
      currency: value.currency,
      direction: value.direction,
      debtorName: value.debtorName,
      debtorIban: value.debtorIban,
      creditorName: value.creditorName,
      creditorIban: value.creditorIban,
      purpose: value.purpose,
      bankReference: value.bankReference,
      endToEndId: value.endToEndId,
      mandateReference: value.mandateReference,
      creditorReference: value.creditorReference,
      bankTransactionCode: value.bankTransactionCode,
      transactionKey,
      normalizedData: value.normalizedData,
    } satisfies Prisma.BankTransactionUncheckedCreateInput;
    const duplicate = await this.prisma.bankTransaction.findFirst({
      where: { tenantId, transactionKey, status: { not: BankTransactionStatus.DUPLICATE } },
      select: { id: true },
    });
    if (duplicate) {
      await this.prisma.bankTransaction.create({
        data: {
          ...data,
          status: BankTransactionStatus.DUPLICATE,
          duplicateOfId: duplicate.id,
          matchReason: "DUPLICATE_TRANSACTION",
        },
      });
      return;
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.bankTransaction.create({ data });
        await this.processImported(tx, created, actorMembershipId);
      });
    } catch (error) {
      if (this.isUnique(error)) {
        const canonical = await this.prisma.bankTransaction.findFirstOrThrow({
          where: { tenantId, transactionKey, status: { not: BankTransactionStatus.DUPLICATE } },
          select: { id: true },
        });
        await this.prisma.bankTransaction.create({
          data: {
            ...data,
            status: BankTransactionStatus.DUPLICATE,
            duplicateOfId: canonical.id,
            matchReason: "DUPLICATE_TRANSACTION",
          },
        });
        return;
      }
      await this.prisma.bankTransaction.create({
        data: { ...data, status: BankTransactionStatus.ERROR, matchReason: "PROCESSING_ERROR" },
      });
    }
  }

  private async processImported(
    tx: Prisma.TransactionClient,
    item: Prisma.BankTransactionGetPayload<Record<string, never>>,
    actorMembershipId: string,
  ) {
    if (item.direction !== BankTransactionDirection.CREDIT || item.amount.lte(0)) {
      await tx.bankTransaction.update({
        where: { id: item.id },
        data: {
          status: BankTransactionStatus.IGNORED,
          matchReason:
            item.direction === BankTransactionDirection.DEBIT
              ? "OUTGOING_TRANSACTION"
              : "NON_POSITIVE_AMOUNT",
        },
      });
      await this.activity.recordStaffEvent(tx, actorMembershipId, {
        tenantId: item.tenantId,
        eventType: ActivityEventType.BANK_TRANSACTION_IGNORED,
        metadata: {
          bankTransactionId: item.id,
          reason:
            item.direction === BankTransactionDirection.DEBIT
              ? "OUTGOING_TRANSACTION"
              : "NON_POSITIVE_AMOUNT",
        },
        sourceEntityType: "BankTransaction",
        sourceEntityId: item.id,
      });
      return;
    }
    const matches = await this.exactCaseMatches(tx, item.tenantId, item.purpose);
    if (item.currency === "EUR" && matches.length === 1) {
      const caseRecord = matches[0];
      await tx.bankTransaction.update({
        where: { id: item.id },
        data: {
          status: BankTransactionStatus.MATCHED,
          matchedCaseId: caseRecord.id,
          matchedPartyId: caseRecord.debtorPartyId,
          matchScore: 100,
          matchReason: "EXACT_CASE_REFERENCE",
        },
      });
      await this.activity.recordStaffEvent(tx, actorMembershipId, {
        tenantId: item.tenantId,
        caseId: caseRecord.id,
        partyId: caseRecord.debtorPartyId,
        eventType: ActivityEventType.BANK_TRANSACTION_AUTO_MATCHED,
        metadata: {
          bankTransactionId: item.id,
          matchReason: "EXACT_CASE_REFERENCE",
          matchScore: 100,
        },
        sourceEntityType: "BankTransaction",
        sourceEntityId: item.id,
      });
      await this.bookPayment(tx, item, caseRecord, actorMembershipId);
      return;
    }
    const reason =
      item.currency !== "EUR"
        ? "UNSUPPORTED_CURRENCY"
        : matches.length > 1
          ? "AMBIGUOUS_CASE_REFERENCE"
          : "NO_EXACT_CASE_REFERENCE";
    await tx.bankTransaction.update({
      where: { id: item.id },
      data: {
        status: BankTransactionStatus.REVIEW_REQUIRED,
        matchedCaseId: matches.length === 1 ? matches[0].id : null,
        matchedPartyId: matches.length === 1 ? matches[0].debtorPartyId : null,
        matchScore: matches.length === 1 ? 100 : null,
        matchReason: reason,
      },
    });
    await this.activity.recordStaffEvent(tx, actorMembershipId, {
      tenantId: item.tenantId,
      eventType: ActivityEventType.BANK_TRANSACTION_REVIEW_REQUIRED,
      metadata: { bankTransactionId: item.id, matchReason: reason, candidateCount: matches.length },
      sourceEntityType: "BankTransaction",
      sourceEntityId: item.id,
    });
  }

  private async bookPayment(
    tx: Prisma.TransactionClient,
    item: {
      id: string;
      tenantId: string;
      bankImportId: string;
      amount: Prisma.Decimal;
      currency: string;
      bookingDate: Date;
      valueDate: Date | null;
      purpose: string;
      bankReference: string | null;
      externalTransactionId: string | null;
    },
    caseRecord: { id: string; debtorPartyId: string },
    actorMembershipId: string,
  ) {
    const result = await this.ledger.applyPaymentInTransaction(tx, {
      tenantId: item.tenantId,
      caseId: caseRecord.id,
      actorMembershipId,
      source: `bank-import:${item.bankImportId}`,
      dto: {
        amount: item.amount.toFixed(2),
        currency: item.currency,
        bookingDate: item.bookingDate.toISOString(),
        valueDate: item.valueDate?.toISOString(),
        description: item.purpose ? `Bankzahlung: ${item.purpose}`.slice(0, 1000) : "Bankzahlung",
        reference: item.bankReference ?? item.externalTransactionId ?? undefined,
        allocationPolicy: AllocationPolicy.BGB_367_DEFAULT,
      },
    });
    await tx.bankTransaction.update({
      where: { id: item.id },
      data: {
        status: BankTransactionStatus.BOOKED,
        matchedCaseId: caseRecord.id,
        matchedPartyId: caseRecord.debtorPartyId,
        paymentId: result.payment.id,
        reviewedByMembershipId: actorMembershipId,
        reviewedAt: new Date(),
      },
    });
    await this.activity.recordStaffEvent(tx, actorMembershipId, {
      tenantId: item.tenantId,
      caseId: caseRecord.id,
      partyId: caseRecord.debtorPartyId,
      eventType: ActivityEventType.BANK_TRANSACTION_BOOKED,
      metadata: { bankTransactionId: item.id, paymentId: result.payment.id },
      sourceEntityType: "BankTransaction",
      sourceEntityId: item.id,
    });
    return result;
  }

  private assertBookableTransaction(item: {
    direction: BankTransactionDirection;
    amount: Prisma.Decimal;
    currency: string;
  }) {
    if (item.direction !== BankTransactionDirection.CREDIT || item.amount.lte(0))
      throw new ConflictException("Nur positive Zahlungseingänge können gebucht werden.");
    if (item.currency !== "EUR")
      throw new ConflictException(
        "P1 unterstützt automatische und manuelle Buchungen ausschließlich in EUR.",
      );
  }

  private async exactCaseMatches(tx: Prisma.TransactionClient, tenantId: string, purpose: string) {
    const normalizedPurpose = this.normalizeReference(purpose);
    if (!normalizedPurpose) return [];
    const cases = await tx.case.findMany({
      where: { tenantId, deletedAt: null, status: CaseStatus.OPEN },
      select: {
        id: true,
        caseNumber: true,
        sequenceYear: true,
        sequenceNumber: true,
        debtorPartyId: true,
      },
    });
    return cases.filter((item) =>
      [...this.caseReferences(item)].some((reference) => normalizedPurpose.includes(reference)),
    );
  }

  private caseReferences(item: {
    caseNumber: string;
    sequenceYear: number;
    sequenceNumber: number;
  }) {
    return new Set([
      this.normalizeReference(item.caseNumber),
      this.normalizeReference(
        `${item.sequenceYear}-${String(item.sequenceNumber).padStart(6, "0")}`,
      ),
      this.normalizeReference(
        `${item.sequenceYear}-${String(item.sequenceNumber).padStart(7, "0")}`,
      ),
    ]);
  }

  private async candidates(item: {
    tenantId: string;
    debtorName: string | null;
    purpose: string;
    matchedCaseId: string | null;
  }) {
    const cases = await this.prisma.case.findMany({
      where: { tenantId: item.tenantId, deletedAt: null, status: CaseStatus.OPEN },
      include: {
        clientParty: { select: { displayName: true } },
        debtorParty: { select: { displayName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const name = this.normalizeName(item.debtorName ?? "");
    const purpose = this.normalizeName(item.purpose);
    const selected = cases
      .filter(
        (value) =>
          value.id === item.matchedCaseId ||
          (name && this.normalizeName(value.debtorParty.displayName) === name) ||
          purpose.includes(this.normalizeName(value.debtorParty.displayName)),
      )
      .slice(0, 10);
    return Promise.all(selected.map((value) => this.caseCandidate(value)));
  }

  private async caseCandidate(item: {
    id: string;
    caseNumber: string;
    clientParty: { displayName: string };
    debtorParty: { displayName: string };
  }) {
    const entries = await this.prisma.caseLedgerEntry.findMany({
      where: { caseId: item.id, status: LedgerEntryStatus.ACTIVE },
      include: { targetAllocations: { where: { status: PaymentAllocationStatus.ACTIVE } } },
    });
    const open = entries
      .filter((entry) => entry.side === LedgerEntrySide.DEBIT)
      .reduce(
        (sum, entry) =>
          sum.plus(
            Prisma.Decimal.max(
              0,
              entry.amount.minus(
                entry.targetAllocations.reduce(
                  (value, allocation) => value.plus(allocation.amount),
                  new Prisma.Decimal(0),
                ),
              ),
            ),
          ),
        new Prisma.Decimal(0),
      );
    return {
      id: item.id,
      caseNumber: item.caseNumber,
      debtorName: item.debtorParty.displayName,
      clientName: item.clientParty.displayName,
      openAmount: open.toFixed(2),
      currency: "EUR",
    };
  }

  private async refreshSummary(id: string, tenantId: string) {
    return this.prisma.$transaction((tx) => this.refreshSummaryWithClient(tx, id, tenantId));
  }

  private async refreshSummaryWithClient(
    tx: Prisma.TransactionClient,
    id: string,
    tenantId: string,
  ) {
    const grouped = await tx.bankTransaction.groupBy({
      by: ["status"],
      where: { bankImportId: id, tenantId },
      _count: { _all: true },
    });
    const count = (statuses: BankTransactionStatus[]) =>
      grouped
        .filter((item) => statuses.includes(item.status))
        .reduce((sum, item) => sum + item._count._all, 0);
    const reviewCount = count([
      BankTransactionStatus.REVIEW_REQUIRED,
      BankTransactionStatus.MATCHED,
    ]);
    const errorCount = count([BankTransactionStatus.ERROR]);
    return tx.bankImport.update({
      where: { id },
      data: {
        transactionCount: grouped.reduce((sum, item) => sum + item._count._all, 0),
        matchedCount: count([
          BankTransactionStatus.MATCHED,
          BankTransactionStatus.BOOKED,
          BankTransactionStatus.PAYMENT_REVERSED,
        ]),
        bookedCount: count([BankTransactionStatus.BOOKED, BankTransactionStatus.PAYMENT_REVERSED]),
        reviewCount,
        duplicateCount: count([BankTransactionStatus.DUPLICATE]),
        errorCount,
        status:
          reviewCount || errorCount
            ? BankImportStatus.COMPLETED_WITH_REVIEW
            : BankImportStatus.COMPLETED,
      },
    });
  }

  private transactionKey(value: ParsedBankTransaction) {
    const strongReference = value.bankReference ?? value.externalTransactionId ?? value.endToEndId;
    const identity = strongReference
      ? `REF|${strongReference}`
      : `FALLBACK|${this.normalizeReference(value.purpose)}|${this.normalizeName(value.debtorName ?? "")}`;
    return this.hash(
      Buffer.from(
        [
          identity,
          value.amount,
          value.currency,
          value.bookingDate.toISOString().slice(0, 10),
          value.debtorIban ?? "",
          value.direction,
        ].join("|"),
      ),
    );
  }

  private serializeTransaction(item: TransactionDetail) {
    return {
      ...item,
      amount: item.amount.toFixed(2),
      normalizedData: undefined,
      transactionKey: undefined,
    };
  }

  private normalizeReference(value: string) {
    return value
      .normalize("NFKC")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  private normalizeName(value: string) {
    return value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  private safeFileName(value: string) {
    return value.replace(/[\r\n"/\\]/g, "_").slice(0, 180) || "bankimport.xml";
  }

  private hash(value: Buffer) {
    return createHash("sha256").update(value).digest("hex");
  }

  private isUnique(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
