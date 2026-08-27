import { Injectable, NotFoundException } from "@nestjs/common";
import { DocumentStatus, LedgerEntrySide, LedgerEntryStatus, LedgerEntryType, PaymentAllocationStatus, PortalVisibility, Prisma } from "@prisma/client";

import { LocalDocumentStorage } from "../documents/local-document-storage";
import { PortalAccessService, type PortalAccessContext } from "../portal-auth/portal-access.service";
import { PrismaService } from "../prisma/prisma.service";

const costTypes = new Set<LedgerEntryType>([LedgerEntryType.COLLECTION_FEE, LedgerEntryType.EXPENSE, LedgerEntryType.COURT_COST, LedgerEntryType.ENFORCEMENT_COST]);
const debtorDocumentLabels: Partial<Record<string, string>> = {
  PAYMENT_REQUEST: "Zahlungsaufforderung",
  SECOND_PAYMENT_REQUEST: "Zweite Zahlungsaufforderung",
  JUDICIAL_DUNNING_NOTICE: "Ankündigung gerichtliches Mahnverfahren",
  ENFORCEMENT_NOTICE: "Vollstreckungsankündigung",
  PAYMENT_PLAN: "Ratenplan",
  TITLE_NOTIFICATION: "Mitteilung der Titulierung",
  CASE_SETTLED: "Erledigterklärung",
  CLAIM_STATEMENT: "Forderungsaufstellung",
  PAYMENT_CONFIRMATION: "Zahlungsbestätigung",
};
type AccessInput = { previewToken?: string; sessionToken?: string };

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService, private readonly access: PortalAccessService, private readonly storage: LocalDocumentStorage) {}

  async clientSummary(input: AccessInput) {
    const context = await this.clientContext(input);
    const cases = await this.clientCases(context.tenantId, context.partyId);
    return { clientName: (await this.party(context.partyId, context.tenantId)).displayName, total: cases.length, open: cases.filter((item) => item.status === "OPEN").length, closed: cases.filter((item) => item.status !== "OPEN").length, principalTotal: cases.reduce((sum, item) => sum.plus(item.claim?.principalAmount ?? 0), new Prisma.Decimal(0)).toFixed(2), recentCases: cases.slice(0, 5) };
  }

  async clientCasesRequest(input: AccessInput) {
    const context = await this.clientContext(input);
    return this.clientCases(context.tenantId, context.partyId);
  }

  async clientCase(id: string, input: AccessInput) {
    const context = await this.clientContext(input);
    const item = await this.clientCaseRecord(id, context.tenantId, context.partyId);
    return { ...item, ledger: await this.ledgerSummary(id, context.tenantId), documents: await this.documents(id, context.tenantId, [PortalVisibility.CLIENT, PortalVisibility.BOTH]) };
  }

  async debtorSummary(input: AccessInput) {
    const context = await this.debtorContext(input);
    const cases = await this.debtorCases(context.tenantId, context.partyId);
    const ledgers = await Promise.all(cases.map((item) => this.ledgerSummary(item.id, context.tenantId)));
    return {
      debtorName: (await this.party(context.partyId, context.tenantId)).displayName,
      totalOpen: ledgers.reduce((sum, ledger) => sum.plus(ledger.totalOpen), new Prisma.Decimal(0)).toFixed(2),
      activeCaseCount: cases.filter((item) => item.status === "OPEN").length,
      focusedCaseId: context.caseId ?? null,
      cases: cases.map((item, index) => ({ ...item, principalAmount: item.claim?.principalAmount.toFixed(2) ?? null, currency: item.claim?.currency ?? "EUR", openAmount: ledgers[index].totalOpen })),
    };
  }

  async debtorCase(id: string, input: AccessInput) {
    const context = await this.debtorContext(input);
    const item = await this.debtorCaseRecord(id, context.tenantId, context.partyId);
    return {
      ...item,
      claim: item.claim ? { ...item.claim, principalAmount: item.claim.principalAmount.toFixed(2) } : null,
      ledger: await this.ledgerSummary(id, context.tenantId),
      payments: await this.payments(id, context.tenantId),
      installmentRequests: await this.prisma.installmentRequest.findMany({ where: { caseId: id, tenantId: context.tenantId, debtorPartyId: context.partyId }, select: { id: true, status: true, requestedMonthlyAmount: true, preferredStartDate: true, numberOfInstallments: true, submittedAt: true }, orderBy: { submittedAt: "desc" } }),
      paymentInformation: await this.paymentInformation(context.tenantId, item.caseNumber),
      documents: await this.documents(id, context.tenantId, [PortalVisibility.DEBTOR, PortalVisibility.BOTH]),
    };
  }

  async debtorClaim(input: AccessInput) {
    const context = await this.debtorContext(input);
    return this.ledgerSummary(await this.focusedDebtorCase(context), context.tenantId);
  }

  async debtorDocuments(input: AccessInput) {
    const context = await this.debtorContext(input);
    const documents = await this.prisma.caseDocument.findMany({
      where: {
        tenantId: context.tenantId,
        status: { not: DocumentStatus.VOIDED },
        portalVisibility: { in: [PortalVisibility.DEBTOR, PortalVisibility.BOTH] },
        case: { debtorPartyId: context.partyId, deletedAt: null },
      },
      select: {
        id: true,
        type: true,
        generatedAt: true,
        storageKey: true,
        template: { select: { name: true } },
        case: { select: { caseNumber: true } },
      },
      orderBy: { generatedAt: "desc" },
    });
    const availability = await Promise.all(
      documents.map(async (document) => ({ document, available: await this.storage.exists(document.storageKey) })),
    );
    return availability
      .filter(({ available }) => available)
      .map(({ document }) => ({
        documentId: document.id,
        documentName: document.template?.name ?? debtorDocumentLabels[document.type] ?? "Dokument",
        createdAt: document.generatedAt,
        documentDate: document.generatedAt,
        caseNumber: document.case.caseNumber,
        canDownload: true,
      }));
  }

  async context(input: AccessInput) {
    const context = await this.anyContext(input);
    return { portalType: context.portalType, mode: context.mode, returnUrl: context.returnUrl };
  }

  async downloadDocument(id: string, input: AccessInput) {
    const context = await this.anyContext(input);
    const visibility = context.portalType === "CLIENT" ? [PortalVisibility.CLIENT, PortalVisibility.BOTH] : [PortalVisibility.DEBTOR, PortalVisibility.BOTH];
    const caseScope = context.portalType === "CLIENT" ? { clientPartyId: context.partyId } : { debtorPartyId: context.partyId };
    const document = await this.prisma.caseDocument.findFirst({ where: { id, tenantId: context.tenantId, status: { not: DocumentStatus.VOIDED }, portalVisibility: { in: visibility }, case: caseScope }, select: { filename: true, mimeType: true, storageKey: true } });
    if (!document) throw new NotFoundException("Dokument wurde nicht gefunden.");
    if (!(await this.storage.exists(document.storageKey))) {
      throw new NotFoundException("Die Dokumentdatei ist nicht verfügbar.");
    }
    return { ...document, buffer: await this.storage.read(document.storageKey) };
  }

  private clientContext(input: AccessInput) { return this.access.resolve(input.previewToken, input.sessionToken, "CLIENT"); }
  private debtorContext(input: AccessInput) { return this.access.resolve(input.previewToken, input.sessionToken, "DEBTOR"); }
  private async anyContext(input: AccessInput) { try { return await this.clientContext(input); } catch { return this.debtorContext(input); } }

  private async clientCases(tenantId: string, partyId: string) {
    return this.prisma.case.findMany({ where: { tenantId, clientPartyId: partyId, deletedAt: null }, select: { id: true, caseNumber: true, status: true, phase: true, openedAt: true, updatedAt: true, claim: { select: { invoiceNumber: true, principalAmount: true, currency: true } }, debtorParty: { select: { displayName: true } } }, orderBy: { updatedAt: "desc" } });
  }
  private async clientCaseRecord(id: string, tenantId: string, partyId: string) {
    const item = await this.prisma.case.findFirst({ where: { id, tenantId, clientPartyId: partyId, deletedAt: null }, select: { id: true, caseNumber: true, status: true, phase: true, openedAt: true, updatedAt: true, claim: { select: { invoiceNumber: true, invoiceDate: true, principalAmount: true, currency: true } }, debtorParty: { select: { displayName: true } } } });
    if (!item) throw new NotFoundException("Inkassoakte wurde nicht gefunden.");
    return item;
  }
  private async debtorCases(tenantId: string, partyId: string) {
    return this.prisma.case.findMany({ where: { tenantId, debtorPartyId: partyId, deletedAt: null }, select: { id: true, caseNumber: true, status: true, phase: true, updatedAt: true, clientParty: { select: { displayName: true } }, claim: { select: { principalAmount: true, currency: true } } }, orderBy: { updatedAt: "desc" } });
  }
  private async focusedDebtorCase(context: PortalAccessContext) {
    if (context.caseId) return context.caseId;
    const item = await this.prisma.case.findFirst({ where: { tenantId: context.tenantId, debtorPartyId: context.partyId, deletedAt: null }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (!item) throw new NotFoundException("Für diesen Schuldner ist keine Inkassoakte verfügbar.");
    return item.id;
  }
  private async debtorCaseRecord(id: string, tenantId: string, partyId: string) {
    const item = await this.prisma.case.findFirst({ where: { id, tenantId, debtorPartyId: partyId, deletedAt: null }, select: { id: true, caseNumber: true, status: true, clientParty: { select: { displayName: true } }, claim: { select: { invoiceNumber: true, principalAmount: true, currency: true } } } });
    if (!item) throw new NotFoundException("Inkassoakte wurde nicht gefunden.");
    return item;
  }
  private async party(id: string, tenantId: string) {
    const item = await this.prisma.party.findFirst({ where: { id, tenantId, deletedAt: null }, select: { displayName: true } });
    if (!item) throw new NotFoundException("Partei wurde nicht gefunden.");
    return item;
  }
  private async ledgerSummary(caseId: string, tenantId: string) {
    const entries = await this.prisma.caseLedgerEntry.findMany({ where: { caseId, tenantId, status: LedgerEntryStatus.ACTIVE }, include: { targetAllocations: { where: { status: PaymentAllocationStatus.ACTIVE } }, paymentAllocations: { where: { status: PaymentAllocationStatus.ACTIVE } } } });
    let principal = new Prisma.Decimal(0), costs = new Prisma.Decimal(0), interest = new Prisma.Decimal(0), payments = new Prisma.Decimal(0), unallocated = new Prisma.Decimal(0);
    for (const item of entries) {
      const allocated = item.targetAllocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0));
      if (item.side === LedgerEntrySide.DEBIT) { const open = Prisma.Decimal.max(0, item.amount.minus(allocated)); if (item.type === LedgerEntryType.PRINCIPAL) principal = principal.plus(open); else if (item.type === LedgerEntryType.INTEREST) interest = interest.plus(open); else if (costTypes.has(item.type)) costs = costs.plus(open); }
      if (item.type === LedgerEntryType.PAYMENT) { payments = payments.plus(item.amount); const used = item.paymentAllocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0)); unallocated = unallocated.plus(Prisma.Decimal.max(0, item.amount.minus(used))); }
    }
    return { openPrincipal: principal.toFixed(2), openCosts: costs.toFixed(2), openInterest: interest.toFixed(2), totalOpen: principal.plus(costs).plus(interest).toFixed(2), payments: payments.toFixed(2), unallocatedPayments: unallocated.toFixed(2) };
  }
  private documents(caseId: string, tenantId: string, visibility: PortalVisibility[]) {
    return this.prisma.caseDocument.findMany({ where: { caseId, tenantId, status: { not: DocumentStatus.VOIDED }, portalVisibility: { in: visibility } }, select: { id: true, filename: true, type: true, generatedAt: true } });
  }
  private async payments(caseId: string, tenantId: string) {
    const entries = await this.prisma.caseLedgerEntry.findMany({ where: { caseId, tenantId, status: LedgerEntryStatus.ACTIVE, type: { in: [LedgerEntryType.PAYMENT, LedgerEntryType.CREDIT_NOTE] } }, include: { paymentAllocations: { where: { status: PaymentAllocationStatus.ACTIVE }, include: { targetEntry: { select: { type: true } } } } }, orderBy: { bookingDate: "desc" } });
    return entries.map((entry) => ({ bookingDate: entry.bookingDate, amount: entry.amount.toFixed(2), description: entry.description, allocations: entry.paymentAllocations.map((allocation) => ({ type: allocation.targetEntry.type, amount: allocation.amount.toFixed(2) })), unallocatedAmount: entry.amount.minus(entry.paymentAllocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0))).toFixed(2) }));
  }
  private async paymentInformation(tenantId: string, caseNumber: string) {
    const settings = await this.prisma.tenantDocumentSettings.findUnique({ where: { tenantId }, select: { companyName: true, iban: true, bic: true, bankName: true } });
    return settings?.iban ? { recipient: settings.companyName, iban: settings.iban, bic: settings.bic, bankName: settings.bankName, reference: caseNumber } : null;
  }
}
