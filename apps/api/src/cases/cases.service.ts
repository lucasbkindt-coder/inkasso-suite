import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  MembershipStatus,
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
} satisfies Prisma.CaseInclude;

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryCasesDto) {
    const tenantId = await this.tenantContext.getTenantId();
    const where: Prisma.CaseWhereInput = {
      tenantId,
      deletedAt: query.deleted ? { not: null } : null,
      status: query.status,
      phase: query.phase,
      priority: query.priority,
      clientPartyId: query.clientPartyId,
      debtorPartyId: query.debtorPartyId,
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
    return this.getCase(id, await this.tenantContext.getTenantId(), true);
  }

  async findByNumber(caseNumber: string) {
    if (!caseNumber?.trim()) throw new BadRequestException("Aktenzeichen ist erforderlich.");
    const tenantId = await this.tenantContext.getTenantId();
    const caseRecord = await this.prisma.case.findFirst({
      where: { tenantId, caseNumber: caseNumber.trim(), deletedAt: null },
      include: caseDetailInclude,
    });
    if (!caseRecord) throw new NotFoundException("Akte wurde nicht gefunden.");
    return caseRecord;
  }

  async create(dto: CreateCaseDto) {
    const tenantId = await this.tenantContext.getTenantId();
    await this.assertPartyRole(dto.clientPartyId, tenantId, PartyRoleType.CLIENT, "Auftraggeber");
    await this.assertPartyRole(dto.debtorPartyId, tenantId, PartyRoleType.DEBTOR, "Schuldner");
    if (dto.ownerMembershipId) await this.assertOwner(dto.ownerMembershipId, tenantId);
    this.validateClaimDates(dto.claim);
    const created = await this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, tenantId, dto),
    );

    return this.getCase(created.id, tenantId, true);
  }

  async createInTransaction(tx: Prisma.TransactionClient, tenantId: string, dto: CreateCaseDto) {
    const principalAmount = this.toDecimal(dto.claim.principalAmount);
    const year = new Date().getUTCFullYear();
    const number = await allocateCaseNumber(tx, tenantId, year);
    return tx.case.create({
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
    });
  }

  async update(id: string, dto: UpdateCaseDto) {
    const tenantId = await this.tenantContext.getTenantId();
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
      }

      await tx.case.update({
        where: { id },
        data: {
          status: dto.status,
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
    await this.getCase(id, tenantId, true);
    await this.prisma.case.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    const tenantId = await this.tenantContext.getTenantId();
    const caseRecord = await this.prisma.case.findFirst({
      where: { id, tenantId, deletedAt: { not: null } },
    });
    if (!caseRecord) throw new NotFoundException("Gelöschte Akte wurde nicht gefunden.");
    await this.prisma.case.update({ where: { id }, data: { deletedAt: null } });
    return this.getCase(id, tenantId, true);
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

  private async assertOwner(membershipId: string, tenantId: string) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId, deletedAt: null, status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (!membership)
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
