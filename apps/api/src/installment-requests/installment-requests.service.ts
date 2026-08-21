import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CaseStatus, InstallmentRequestStatus, LedgerEntrySide, LedgerEntryStatus, Prisma } from "@prisma/client";
import { PortalAccessService } from "../portal-auth/portal-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateInstallmentRequestDto } from "./dto/create-installment-request.dto";

@Injectable()
export class InstallmentRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService, private readonly access: PortalAccessService) {}
  async createPortal(caseId: string, dto: CreateInstallmentRequestDto, previewToken?: string, sessionToken?: string) {
    const context = await this.access.resolve(previewToken, sessionToken, "DEBTOR");
    if (context.mode === "PREVIEW") throw new ConflictException("In der internen Portalvorschau können keine Ratenanfragen abgesendet werden.");
    const amount = new Prisma.Decimal(dto.requestedMonthlyAmount);
    if (amount.lte(0) || new Date(dto.preferredStartDate) < new Date(new Date().toDateString())) throw new BadRequestException("Bitte geben Sie eine sinnvolle monatliche Rate und einen zukünftigen Starttermin an.");
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`installment-request:${caseId}`}))`;
      const caseRecord = await tx.case.findFirst({ where: { id: caseId, tenantId: context.tenantId, debtorPartyId: context.partyId, deletedAt: null, status: CaseStatus.OPEN }, select: { id: true } });
      if (!caseRecord) throw new NotFoundException("Inkassoakte wurde nicht gefunden.");
      const open = await this.openAmount(tx, caseId, context.tenantId);
      if (open.lte(0)) throw new BadRequestException("Für diese Akte besteht keine offene Forderung.");
      const existing = await tx.installmentRequest.findFirst({ where: { caseId, status: { in: [InstallmentRequestStatus.SUBMITTED, InstallmentRequestStatus.UNDER_REVIEW] } }, select: { id: true } });
      if (existing) throw new ConflictException("Für diese Akte liegt bereits eine offene Ratenanfrage vor.");
      return tx.installmentRequest.create({ data: { tenantId: context.tenantId, caseId, debtorPartyId: context.partyId, requestedMonthlyAmount: amount, preferredStartDate: new Date(dto.preferredStartDate), numberOfInstallments: dto.numberOfInstallments, debtorMessage: dto.debtorMessage?.trim() || null } });
    });
  }
  async portalForCase(caseId: string, previewToken?: string, sessionToken?: string) {
    const context = await this.access.resolve(previewToken, sessionToken, "DEBTOR");
    return this.prisma.installmentRequest.findMany({ where: { caseId, tenantId: context.tenantId, debtorPartyId: context.partyId }, orderBy: { submittedAt: "desc" } });
  }
  async list() { const tenantId = await this.tenant.getTenantId(); return this.prisma.installmentRequest.findMany({ where: { tenantId }, include: { case: { select: { caseNumber: true, clientParty: { select: { displayName: true } }, debtorParty: { select: { displayName: true } } } }, debtorParty: { select: { displayName: true } } }, orderBy: { submittedAt: "desc" } }); }
  async one(id: string) { const tenantId = await this.tenant.getTenantId(); const item = await this.prisma.installmentRequest.findFirst({ where: { id, tenantId }, include: { case: { select: { caseNumber: true, clientParty: { select: { displayName: true } }, debtorParty: { select: { displayName: true } } } } } }); if (!item) throw new NotFoundException("Ratenanfrage wurde nicht gefunden."); return item; }
  async transition(id: string, status: InstallmentRequestStatus) { const item = await this.one(id); const now = new Date(); return this.prisma.installmentRequest.update({ where: { id: item.id }, data: { status, reviewedAt: status === InstallmentRequestStatus.UNDER_REVIEW ? now : undefined, approvedAt: status === InstallmentRequestStatus.APPROVED ? now : undefined, rejectedAt: status === InstallmentRequestStatus.REJECTED ? now : undefined } }); }
  private async openAmount(tx: Prisma.TransactionClient, caseId: string, tenantId: string) { const entries = await tx.caseLedgerEntry.findMany({ where: { caseId, tenantId, status: LedgerEntryStatus.ACTIVE }, select: { side: true, amount: true } }); return entries.filter((entry) => entry.side === LedgerEntrySide.DEBIT).reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0)); }
}
