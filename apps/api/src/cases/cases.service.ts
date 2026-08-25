import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  MembershipStatus,
  ActivityEventType,
  LedgerEntrySide,
  LedgerEntryType,
  PartyRoleType,
  Prisma,
  type CasePhase,
  type CasePriority,
  type CaseStatus,
  type ClaimStatus,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { StaffAuthService } from "../staff-auth/staff-auth.service";
import { ActivityService } from "../activity/activity.service";
import { allocateCaseNumber } from "./case-number.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { QueryCasesDto } from "./dto/query-cases.dto";
import { UpdateCaseDto } from "./dto/update-case.dto";

const partyDetailInclude = {
  person: true,
  company: true,
  roles: { where: { deletedAt: null } },
  addresses: { where: { deletedAt: null, isPrimary: true } },
  contacts: { where: { deletedAt: null, isPrimary: true } },
} satisfies Prisma.PartyInclude;

const caseDetailInclude = {
  claim: true,
  clientParty: { include: partyDetailInclude },
  debtorParty: { include: partyDetailInclude },
  ownerMembership: { include: { user: true } },
  assignedMembership: { include: { user: true } },
} satisfies Prisma.CaseInclude;

const caseStatusLabel: Record<CaseStatus, string> = {
  OPEN: "Offen",
  CLOSED: "Erledigt",
  CANCELLED: "Storniert",
};

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly staffAuth: StaffAuthService,
    private readonly activity: ActivityService,
  ) {}

  async findAll(query: QueryCasesDto) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:read");
    const where: Prisma.CaseWhereInput = {
      tenantId,
      deletedAt: query.deleted ? { not: null } : null,
      status: query.status,
      phase: query.phase,
      priority: query.priority,
      clientPartyId: query.clientPartyId,
      debtorPartyId: query.debtorPartyId,
      assignedMembershipId: query.mine
        ? this.tenantContext.getStaffContext().tenantMembershipId
        : query.unassigned
          ? null
          : query.assignedMembershipId,
    };

    if (query.search) {
      where.OR = [
        { caseNumber: { contains: query.search, mode: "insensitive" } },
        { claim: { is: { invoiceNumber: { contains: query.search, mode: "insensitive" } } } },
        { clientParty: { is: { displayName: { contains: query.search, mode: "insensitive" } } } },
        { debtorParty: { is: { displayName: { contains: query.search, mode: "insensitive" } } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        include: caseDetailInclude,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.case.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string) {
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:read");
    return this.getCase(id, await this.tenantContext.getTenantId(), true);
  }

  async findByNumber(caseNumber: string) {
    if (!caseNumber?.trim()) throw new BadRequestException("Aktenzeichen ist erforderlich.");
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:read");
    const caseRecord = await this.prisma.case.findFirst({
      where: { tenantId, caseNumber: caseNumber.trim(), deletedAt: null },
      include: caseDetailInclude,
    });
    if (!caseRecord) throw new NotFoundException("Akte wurde nicht gefunden.");
    return caseRecord;
  }

  async create(dto: CreateCaseDto) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:create");
    await this.assertPartyRole(dto.clientPartyId, tenantId, PartyRoleType.CLIENT, "Auftraggeber");
    await this.assertPartyRole(dto.debtorPartyId, tenantId, PartyRoleType.DEBTOR, "Schuldner");
    if (dto.ownerMembershipId) await this.assertOwner(dto.ownerMembershipId, tenantId);
    this.validateClaimDates(dto.claim);
    const actorMembershipId = this.tenantContext.getStaffContext().tenantMembershipId;
    const created = await this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, tenantId, dto, actorMembershipId),
    );

    return this.getCase(created.id, tenantId, true);
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    dto: CreateCaseDto,
    actorMembershipId?: string,
  ) {
    const principalAmount = this.toDecimal(dto.claim.principalAmount);
    const year = new Date().getUTCFullYear();
    const number = await allocateCaseNumber(tx, tenantId, year);
    const created = await tx.case.create({
      data: {
        tenantId,
        caseNumber: number.caseNumber,
        sequenceYear: number.sequenceYear,
        sequenceNumber: number.sequenceNumber,
        clientPartyId: dto.clientPartyId,
        debtorPartyId: dto.debtorPartyId,
        ownerMembershipId: dto.ownerMembershipId,
        priority: dto.priority,
        internalNotes: dto.internalNotes,
        claim: {
          create: {
            tenantId,
            invoiceNumber: dto.claim.invoiceNumber.trim(),
            invoiceDate: new Date(dto.claim.invoiceDate),
            dueDate: new Date(dto.claim.dueDate),
            defaultDate: dto.claim.defaultDate ? new Date(dto.claim.defaultDate) : undefined,
            principalAmount,
            currency: dto.claim.currency.toUpperCase(),
            description: dto.claim.description,
          },
        },
        ledgerEntries: {
          create: {
            tenantId,
            side: LedgerEntrySide.DEBIT,
            type: LedgerEntryType.PRINCIPAL,
            amount: principalAmount,
            currency: dto.claim.currency.toUpperCase(),
            bookingDate: new Date(dto.claim.invoiceDate),
            description: `Hauptforderung ${dto.claim.invoiceNumber.trim()}`,
            source: "case-create",
            createdByMembershipId: dto.ownerMembershipId,
          },
        },
      },
      include: { claim: true },
    });
    if (actorMembershipId) {
      await this.activity.recordStaffEvent(tx, actorMembershipId, {
        tenantId,
        caseId: created.id,
        partyId: created.debtorPartyId,
        eventType: ActivityEventType.CASE_CREATED,
        description: `Inkassoakte ${created.caseNumber} wurde angelegt.`,
        metadata: { caseNumber: created.caseNumber },
        sourceEntityType: "Case",
        sourceEntityId: created.id,
      });
      await this.activity.recordStaffEvent(tx, actorMembershipId, {
        tenantId,
        caseId: created.id,
        partyId: created.debtorPartyId,
        eventType: ActivityEventType.CLAIM_CREATED,
        description: `Forderung über ${created.claim?.principalAmount.toFixed(2) ?? dto.claim.principalAmount} ${dto.claim.currency.toUpperCase()} wurde angelegt.`,
        metadata: { claimId: created.claim?.id, amount: created.claim?.principalAmount.toFixed(2) ?? dto.claim.principalAmount },
        sourceEntityType: "Claim",
        sourceEntityId: created.claim?.id,
      });
    }
    return created;
  }

  async update(id: string, dto: UpdateCaseDto) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:update");
    const existing = await this.getCase(id, tenantId, true);
    if (dto.ownerMembershipId) await this.assertOwner(dto.ownerMembershipId, tenantId);

    if (dto.claim) {
      this.validateClaimDates({
        invoiceDate: dto.claim.invoiceDate ?? existing.claim?.invoiceDate.toISOString(),
        dueDate: dto.claim.dueDate ?? existing.claim?.dueDate.toISOString(),
        defaultDate:
          dto.claim.defaultDate === undefined
            ? existing.claim?.defaultDate?.toISOString()
            : dto.claim.defaultDate,
      });
      if (dto.claim.principalAmount) this.toDecimal(dto.claim.principalAmount);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.claim) {
        if (!existing.claim) throw new NotFoundException("Forderung wurde nicht gefunden.");
        await tx.claim.update({
          where: { caseId: id },
          data: {
            invoiceNumber: dto.claim.invoiceNumber?.trim(),
            invoiceDate: dto.claim.invoiceDate ? new Date(dto.claim.invoiceDate) : undefined,
            dueDate: dto.claim.dueDate ? new Date(dto.claim.dueDate) : undefined,
            defaultDate:
              dto.claim.defaultDate === undefined ? undefined : new Date(dto.claim.defaultDate),
            principalAmount: dto.claim.principalAmount
              ? this.toDecimal(dto.claim.principalAmount)
              : undefined,
            currency: dto.claim.currency?.toUpperCase(),
            description: dto.claim.description,
            status: dto.claim.status,
          },
        });
        await this.activity.recordStaffEvent(tx, this.tenantContext.getStaffContext().tenantMembershipId, {
          tenantId,
          caseId: id,
          partyId: existing.debtorPartyId,
          eventType: ActivityEventType.CLAIM_UPDATED,
          description: "Forderung wurde bearbeitet.",
          metadata: { claimId: existing.claim.id, changedFields: Object.keys(dto.claim) },
          sourceEntityType: "Claim",
          sourceEntityId: existing.claim.id,
        });
      }

      await tx.case.update({
        where: { id },
        data: {
          phase: dto.phase,
          priority: dto.priority,
          ownerMembershipId: dto.ownerMembershipId,
          internalNotes: dto.internalNotes,
        },
      });
      return this.getCaseWithClient(tx, id, tenantId, true);
    });
  }

  async remove(id: string) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:update");
    await this.getCase(id, tenantId, true);
    await this.prisma.case.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:update");
    const caseRecord = await this.prisma.case.findFirst({
      where: { id, tenantId, deletedAt: { not: null } },
    });
    if (!caseRecord) throw new NotFoundException("Gelöschte Akte wurde nicht gefunden.");
    await this.prisma.case.update({ where: { id }, data: { deletedAt: null } });
    return this.getCase(id, tenantId, true);
  }

  async assign(id: string, membershipId: string | null) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:assign");
    const existing = await this.getCase(id, tenantId, true);
    if (membershipId) await this.assertOwner(membershipId, tenantId);
    await this.prisma.$transaction(async (tx) => {
      await tx.case.update({ where: { id }, data: { assignedMembershipId: membershipId } });
      await this.activity.recordStaffEvent(tx, this.tenantContext.getStaffContext().tenantMembershipId, {
        tenantId,
        caseId: id,
        partyId: existing.debtorPartyId,
        eventType: ActivityEventType.CASE_ASSIGNEE_CHANGED,
        description: "Sachbearbeitung wurde geändert.",
        metadata: { previousMembershipId: existing.assignedMembershipId, newMembershipId: membershipId },
        sourceEntityType: "Case",
        sourceEntityId: id,
      });
    });
    return this.getCase(id, tenantId, true);
  }

  async availableStatusTransitions(id: string) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:read");
    const caseRecord = await this.getCase(id, tenantId, true);
    return { currentStatus: caseRecord.status, allowedTargetStatuses: this.allowedStatusTransitions(caseRecord.status) };
  }

  async transitionStatus(id: string, targetStatus: CaseStatus) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:update");
    const caseRecord = await this.getCase(id, tenantId, true);
    if (!this.allowedStatusTransitions(caseRecord.status).includes(targetStatus)) {
      throw new ConflictException(`Der Status ${targetStatus} ist aus ${caseRecord.status} nicht zulässig.`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.case.update({ where: { id }, data: { status: targetStatus, closedAt: targetStatus === "CLOSED" ? new Date() : null } });
      await this.activity.recordStaffEvent(tx, this.tenantContext.getStaffContext().tenantMembershipId, {
        tenantId,
        caseId: id,
        partyId: caseRecord.debtorPartyId,
        eventType: ActivityEventType.CASE_STATUS_CHANGED,
        description: `Aktenstatus wurde von ${caseStatusLabel[caseRecord.status]} auf ${caseStatusLabel[targetStatus]} geändert.`,
        metadata: { fromStatus: caseRecord.status, toStatus: targetStatus },
        sourceEntityType: "Case",
        sourceEntityId: id,
      });
    });
    return this.getCase(id, tenantId, true);
  }

  async activities(id: string, page = 1, limit = 25) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "case:read");
    await this.getCase(id, tenantId, true);
    return this.activity.listForCase(tenantId, id, page, limit);
  }

  private async assertPartyRole(
    partyId: string,
    tenantId: string,
    role: PartyRoleType,
    label: string,
  ) {
    const party = await this.prisma.party.findFirst({
      where: { id: partyId, tenantId, deletedAt: null, roles: { some: { role, deletedAt: null } } },
      select: { id: true },
    });
    if (!party)
      throw new BadRequestException(`${label} muss eine aktive Partei dieses Mandanten sein.`);
  }

  private allowedStatusTransitions(status: CaseStatus): CaseStatus[] {
    const transitions: Record<CaseStatus, CaseStatus[]> = {
      OPEN: ["CLOSED", "CANCELLED"],
      CLOSED: ["OPEN"],
      CANCELLED: ["OPEN"],
    };
    return transitions[status];
  }

  private async assertOwner(membershipId: string, tenantId: string) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId, deletedAt: null, status: MembershipStatus.ACTIVE },
      select: { id: true, user: { select: { isActive: true, deletedAt: true } } },
    });
    if (!membership || !membership.user.isActive || membership.user.deletedAt)
      throw new BadRequestException(
        "Verantwortliche Mitgliedschaft ist nicht aktiv oder gehört nicht zum Mandanten.",
      );
  }

  private async getCase(id: string, tenantId: string, active: boolean) {
    return this.getCaseWithClient(this.prisma, id, tenantId, active);
  }

  private async getCaseWithClient(
    client: Prisma.TransactionClient | PrismaService,
    id: string,
    tenantId: string,
    active: boolean,
  ) {
    const caseRecord = await client.case.findFirst({
      where: { id, tenantId, deletedAt: active ? null : undefined },
      include: caseDetailInclude,
    });
    if (!caseRecord) throw new NotFoundException("Akte wurde nicht gefunden.");
    return caseRecord;
  }

  private toDecimal(value: string) {
    const amount = new Prisma.Decimal(value);
    if (amount.isNegative())
      throw new BadRequestException("Die Hauptforderung darf nicht negativ sein.");
    return amount;
  }

  private validateClaimDates(claim: {
    invoiceDate?: string;
    dueDate?: string;
    defaultDate?: string | null;
  }) {
    if (!claim.invoiceDate || !claim.dueDate) return;
    const invoiceDate = new Date(claim.invoiceDate);
    const dueDate = new Date(claim.dueDate);
    const defaultDate = claim.defaultDate ? new Date(claim.defaultDate) : undefined;
    if (dueDate < invoiceDate)
      throw new BadRequestException(
        "Das Fälligkeitsdatum darf nicht vor dem Rechnungsdatum liegen.",
      );
    if (defaultDate && defaultDate < dueDate)
      throw new BadRequestException("Das Verzugdatum darf nicht vor dem Fälligkeitsdatum liegen.");
  }
}
