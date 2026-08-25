import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityEventType, CaseStatus, InstallmentRequestStatus, LedgerEntrySide, LedgerEntryStatus, Prisma } from "@prisma/client";
import { ActivityService } from "../activity/activity.service";
import { PortalAccessService } from "../portal-auth/portal-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateInstallmentRequestDto } from "./dto/create-installment-request.dto";

@Injectable()
export class InstallmentRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService, private readonly access: PortalAccessService, private readonly activity: ActivityService) {}
  async createPortal(caseId: string, dto: CreateInstallmentRequestDto, previewToken?: string, sessionToken?: string) {
    const context = await this.access.resolve(previewToken, sessionToken, "DEBTOR");
    if (context.mode === "PREVIEW") throw new ConflictException("In der internen Portalvorschau können keine Ratenanfragen abgesendet werden.");
    if (!context.portalAccountId) throw new ConflictException("Portalzugang konnte nicht zugeordnet werden.");
    const portalAccountId = context.portalAccountId;
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
      const request = await tx.installmentRequest.create({ data: { tenantId: context.tenantId, caseId, debtorPartyId: context.partyId, requestedMonthlyAmount: amount, preferredStartDate: new Date(dto.preferredStartDate), numberOfInstallments: dto.numberOfInstallments, debtorMessage: dto.debtorMessage?.trim() || null } });
      await this.activity.recordPortalEvent(tx, portalAccountId, { tenantId: context.tenantId, caseId, partyId: context.partyId, eventType: ActivityEventType.INSTALLMENT_REQUEST_CREATED, description: "Ratenanfrage wurde über das Schuldnerportal eingereicht.", metadata: { installmentRequestId: request.id, requestedMonthlyAmount: amount.toFixed(2) }, sourceEntityType: "InstallmentRequest", sourceEntityId: request.id });
      return request;
    });
  }
  async portalForCase(caseId: string, previewToken?: string, sessionToken?: string) {
    const context = await this.access.resolve(previewToken, sessionToken, "DEBTOR");
    return this.prisma.installmentRequest.findMany({ where: { caseId, tenantId: context.tenantId, debtorPartyId: context.partyId }, orderBy: { submittedAt: "desc" } });
  }
  async list() { const tenantId = await this.tenant.getTenantId(); return this.prisma.installmentRequest.findMany({ where: { tenantId }, include: { case: { select: { caseNumber: true, clientParty: { select: { displayName: true } }, debtorParty: { select: { displayName: true } } } }, debtorParty: { select: { displayName: true } } }, orderBy: { submittedAt: "desc" } }); }
  async one(id: string) { const tenantId = await this.tenant.getTenantId(); const item = await this.prisma.installmentRequest.findFirst({ where: { id, tenantId }, include: { case: { select: { caseNumber: true, clientParty: { select: { displayName: true } }, debtorParty: { select: { displayName: true } } } } } }); if (!item) throw new NotFoundException("Ratenanfrage wurde nicht gefunden."); return item; }
  async transition(id: string, status: InstallmentRequestStatus) { const item = await this.one(id); const now = new Date(); const reviewedByMembershipId = this.tenant.getStaffContext().tenantMembershipId; return this.prisma.$transaction(async (tx) => { const updated = await tx.installmentRequest.update({ where: { id: item.id }, data: { status, reviewedAt: status === InstallmentRequestStatus.UNDER_REVIEW ? now : undefined, approvedAt: status === InstallmentRequestStatus.APPROVED ? now : undefined, rejectedAt: status === InstallmentRequestStatus.REJECTED ? now : undefined, reviewedByMembershipId } }); const eventType = status === InstallmentRequestStatus.APPROVED ? ActivityEventType.INSTALLMENT_REQUEST_APPROVED : status === InstallmentRequestStatus.REJECTED ? ActivityEventType.INSTALLMENT_REQUEST_REJECTED : ActivityEventType.INSTALLMENT_REQUEST_REVIEWED; await this.activity.recordStaffEvent(tx, reviewedByMembershipId, { tenantId: updated.tenantId, caseId: updated.caseId, partyId: updated.debtorPartyId, eventType, description: eventType === ActivityEventType.INSTALLMENT_REQUEST_APPROVED ? "Ratenanfrage wurde genehmigt." : eventType === ActivityEventType.INSTALLMENT_REQUEST_REJECTED ? "Ratenanfrage wurde abgelehnt." : "Ratenanfrage wurde geprüft.", metadata: { installmentRequestId: updated.id, status: updated.status }, sourceEntityType: "InstallmentRequest", sourceEntityId: updated.id }); return updated; }); }
  private async openAmount(tx: Prisma.TransactionClient, caseId: string, tenantId: string) { const entries = await tx.caseLedgerEntry.findMany({ where: { caseId, tenantId, status: LedgerEntryStatus.ACTIVE }, select: { side: true, amount: true } }); return entries.filter((entry) => entry.side === LedgerEntrySide.DEBIT).reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0)); }
}
