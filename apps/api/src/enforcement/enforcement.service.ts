import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityEventType, EnforcementActionStatus, EnforcementTitleStatus, Prisma } from "@prisma/client";

import { ActivityService } from "../activity/activity.service";
import { PrismaService } from "../prisma/prisma.service";
import { StaffAuthService } from "../staff-auth/staff-auth.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateEnforcementActionDto, CreateEnforcementTitleDto } from "./enforcement.dto";

@Injectable()
export class EnforcementService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService, private readonly staff: StaffAuthService, private readonly activity: ActivityService) {}

  async titles(caseId: string) { const tenantId = await this.tenant.getTenantId(); this.staff.requirePermission(this.tenant.getStaffContext(), "claim:read"); return this.prisma.enforcementTitle.findMany({ where: { tenantId, caseId }, orderBy: { titleDate: "desc" } }); }

  async createTitle(caseId: string, dto: CreateEnforcementTitleDto) {
    const tenantId = await this.tenant.getTenantId(); const context = this.tenant.getStaffContext(); this.staff.requirePermission(context, "case:update");
    const caseRecord = await this.prisma.case.findFirst({ where: { id: caseId, tenantId, deletedAt: null }, select: { debtorPartyId: true } }); if (!caseRecord) throw new NotFoundException("Inkassoakte wurde nicht gefunden.");
    const principal = new Prisma.Decimal(dto.principalAmount), costs = new Prisma.Decimal(dto.costAmount ?? "0"), interest = new Prisma.Decimal(dto.interestAmount ?? "0");
    return this.prisma.$transaction(async (tx) => { const title = await tx.enforcementTitle.create({ data: { tenantId, caseId, type: dto.type, status: dto.status ?? EnforcementTitleStatus.DRAFT, courtOrAuthority: dto.courtOrAuthority?.trim() || null, referenceNumber: dto.referenceNumber?.trim() || null, titleDate: new Date(dto.titleDate), serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : null, enforceableFrom: dto.enforceableFrom ? new Date(dto.enforceableFrom) : null, principalAmount: principal, costAmount: costs, interestAmount: interest, titleTotal: principal.plus(costs).plus(interest), notes: dto.notes?.trim() || null, createdByMembershipId: context.tenantMembershipId } }); await this.activity.recordStaffEvent(tx, context.tenantMembershipId, { tenantId, caseId, partyId: caseRecord.debtorPartyId, eventType: ActivityEventType.TITLE_CREATED, description: "Titel wurde erfasst.", metadata: { titleId: title.id, type: title.type, titleTotal: title.titleTotal.toFixed(2) }, sourceEntityType: "EnforcementTitle", sourceEntityId: title.id }); return title; });
  }

  async updateTitleStatus(caseId: string, titleId: string, status: EnforcementTitleStatus) {
    const tenantId = await this.tenant.getTenantId(); const context = this.tenant.getStaffContext(); this.staff.requirePermission(context, "case:update");
    const title = await this.prisma.enforcementTitle.findFirst({ where: { id: titleId, caseId, tenantId }, include: { case: { select: { debtorPartyId: true } } } }); if (!title) throw new NotFoundException("Titel wurde nicht gefunden.");
    const eventType = status === EnforcementTitleStatus.ACTIVE ? ActivityEventType.TITLE_ACTIVATED : status === EnforcementTitleStatus.VOIDED ? ActivityEventType.TITLE_VOIDED : ActivityEventType.TITLE_SATISFIED;
    if (status === EnforcementTitleStatus.DRAFT) throw new BadRequestException("Ein Titel kann nicht in den Entwurfsstatus zurückgesetzt werden.");
    return this.prisma.$transaction(async (tx) => { const updated = await tx.enforcementTitle.update({ where: { id: title.id }, data: { status } }); await this.activity.recordStaffEvent(tx, context.tenantMembershipId, { tenantId, caseId, partyId: title.case.debtorPartyId, eventType, metadata: { titleId: title.id, status }, sourceEntityType: "EnforcementTitle", sourceEntityId: title.id }); return updated; });
  }

  async createAction(caseId: string, dto: CreateEnforcementActionDto) {
    const tenantId = await this.tenant.getTenantId(); const context = this.tenant.getStaffContext(); this.staff.requirePermission(context, "case:update");
    const title = await this.prisma.enforcementTitle.findFirst({ where: { id: dto.titleId, caseId, tenantId, status: EnforcementTitleStatus.ACTIVE }, include: { case: { select: { debtorPartyId: true } } } }); if (!title) throw new BadRequestException("Eine aktive Vollstreckungsgrundlage ist erforderlich.");
    return this.prisma.$transaction(async (tx) => { const action = await tx.enforcementAction.create({ data: { tenantId, caseId, titleId: title.id, type: dto.type, amountAtRequest: new Prisma.Decimal(dto.amountAtRequest), referenceNumber: dto.referenceNumber?.trim() || null, notes: dto.notes?.trim() || null, createdByMembershipId: context.tenantMembershipId } }); await this.activity.recordStaffEvent(tx, context.tenantMembershipId, { tenantId, caseId, partyId: title.case.debtorPartyId, eventType: ActivityEventType.ENFORCEMENT_ACTION_CREATED, metadata: { enforcementActionId: action.id, titleId: title.id, type: action.type }, sourceEntityType: "EnforcementAction", sourceEntityId: action.id }); return action; });
  }

  async actions(caseId: string) { const tenantId = await this.tenant.getTenantId(); this.staff.requirePermission(this.tenant.getStaffContext(), "claim:read"); return this.prisma.enforcementAction.findMany({ where: { tenantId, caseId }, include: { title: true }, orderBy: { createdAt: "desc" } }); }
  async updateActionStatus(caseId: string, actionId: string, status: EnforcementActionStatus) { const tenantId = await this.tenant.getTenantId(); const context = this.tenant.getStaffContext(); this.staff.requirePermission(context, "case:update"); const action = await this.prisma.enforcementAction.findFirst({ where: { id: actionId, caseId, tenantId }, include: { case: { select: { debtorPartyId: true } } } }); if (!action) throw new NotFoundException("Vollstreckungsmaßnahme wurde nicht gefunden."); if (!this.allowedActionTransitions(action.status).includes(status)) throw new ConflictException("Dieser Statusübergang ist für die Vollstreckungsmaßnahme nicht zulässig."); return this.prisma.$transaction(async (tx) => { const updated = await tx.enforcementAction.update({ where: { id: action.id }, data: { status, requestedAt: status === EnforcementActionStatus.SUBMITTED ? new Date() : undefined, completedAt: status === EnforcementActionStatus.COMPLETED ? new Date() : undefined } }); await this.activity.recordStaffEvent(tx, context.tenantMembershipId, { tenantId, caseId, partyId: action.case.debtorPartyId, eventType: ActivityEventType.ENFORCEMENT_ACTION_STATUS_CHANGED, metadata: { enforcementActionId: action.id, fromStatus: action.status, toStatus: status }, sourceEntityType: "EnforcementAction", sourceEntityId: action.id }); return updated; }); }
  private allowedActionTransitions(status: EnforcementActionStatus): EnforcementActionStatus[] { return { DRAFT: [EnforcementActionStatus.PREPARED, EnforcementActionStatus.CANCELLED], PREPARED: [EnforcementActionStatus.SUBMITTED, EnforcementActionStatus.CANCELLED], SUBMITTED: [EnforcementActionStatus.IN_PROGRESS, EnforcementActionStatus.FAILED, EnforcementActionStatus.CANCELLED], IN_PROGRESS: [EnforcementActionStatus.COMPLETED, EnforcementActionStatus.FAILED, EnforcementActionStatus.CANCELLED], COMPLETED: [], FAILED: [], CANCELLED: [] }[status]; }
}
