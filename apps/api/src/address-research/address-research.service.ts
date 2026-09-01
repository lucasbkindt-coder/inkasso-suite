import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ActivityEventType,
  AddressResearchProviderType,
  AddressResearchStatus,
  AddressType,
  MembershipStatus,
  PartyRoleType,
  Prisma,
} from "@prisma/client";
import { ActivityService } from "../activity/activity.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { AddAddressResearchResultDto, CreateAddressResearchDto, QueryAddressResearchDto } from "./dto";
import { AddressResearchProviderService } from "./providers/address-research-provider.service";

const detailInclude = {
  party: { select: { id: true, displayName: true, processingRestrictedAt: true, addresses: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] } } },
  case: { select: { id: true, caseNumber: true } },
  requestedByMembership: { select: { id: true, user: { select: { displayName: true, email: true } } } },
  results: { orderBy: { createdAt: "asc" }, include: { appliedByMembership: { select: { user: { select: { displayName: true, email: true } } } } } },
} satisfies Prisma.AddressResearchRequestInclude;

const openStatuses: AddressResearchStatus[] = [AddressResearchStatus.CREATED, AddressResearchStatus.IN_PROGRESS, AddressResearchStatus.RESULT_AVAILABLE, AddressResearchStatus.REVIEW_REQUIRED];

@Injectable()
export class AddressResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly activity: ActivityService,
    private readonly providers: AddressResearchProviderService,
  ) {}

  async list(query: QueryAddressResearchDto) {
    const tenantId = await this.tenant.getTenantId();
    const where: Prisma.AddressResearchRequestWhereInput = {
      tenantId,
      status: query.status,
      reason: query.reason,
      requestedByMembershipId: query.requestedByMembershipId,
      partyId: query.partyId,
      caseId: query.caseId,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.addressResearchRequest.findMany({ where, include: detailInclude, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.addressResearchRequest.count({ where }),
    ]);
    return { items: items.map((item) => this.serialize(item)), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async options() {
    const tenantId = await this.tenant.getTenantId();
    const [parties, assignees, cases] = await Promise.all([
      this.prisma.party.findMany({ where: { tenantId, deletedAt: null, roles: { some: { role: PartyRoleType.DEBTOR, deletedAt: null } } }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
      this.prisma.tenantMembership.findMany({ where: { tenantId, status: MembershipStatus.ACTIVE, deletedAt: null, user: { isActive: true, deletedAt: null } }, select: { id: true, user: { select: { displayName: true, email: true } } }, orderBy: { createdAt: "asc" } }),
      this.prisma.case.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, caseNumber: true, debtorPartyId: true }, orderBy: { openedAt: "desc" } }),
    ]);
    return { parties, assignees: assignees.map((item) => ({ id: item.id, displayName: item.user.displayName ?? item.user.email })), cases };
  }

  async get(id: string) {
    const item = await this.find(id);
    return this.serialize(item);
  }

  async create(dto: CreateAddressResearchDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const party = await this.assertDebtor(tenantId, dto.partyId);
    if (dto.caseId) await this.assertCase(tenantId, dto.caseId, party.id);
    const current = this.currentAddress(party.addresses);
    const cost = dto.costAmount === undefined ? undefined : new Prisma.Decimal(dto.costAmount);
    if (cost?.isNegative()) throw new BadRequestException("Recherchekosten dürfen nicht negativ sein.");
    if (cost && !dto.costCurrency) throw new BadRequestException("Für Recherchekosten ist eine Währung erforderlich.");
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.addressResearchRequest.create({
        data: {
          tenantId,
          partyId: party.id,
          caseId: dto.caseId,
          status: AddressResearchStatus.IN_PROGRESS,
          reason: dto.reason,
          provider: dto.provider,
          requestedByMembershipId: actor.tenantMembershipId,
          costAmount: cost,
          costCurrency: cost ? dto.costCurrency!.toUpperCase() : undefined,
          notes: dto.notes?.trim() || undefined,
          originalAddressId: current?.id,
          originalStreet: current?.street,
          originalHouseNumber: current?.houseNumber,
          originalAddressLine2: current?.addressLine2,
          originalPostalCode: current?.postalCode,
          originalCity: current?.city,
          originalCountry: current?.country,
        },
        include: detailInclude,
      });
      await this.activity.recordStaffEvent(tx, actor.tenantMembershipId, { tenantId, partyId: party.id, caseId: dto.caseId, eventType: ActivityEventType.ADDRESS_RESEARCH_CREATED, sourceEntityType: "AddressResearchRequest", sourceEntityId: item.id, metadata: { reason: item.reason, provider: item.provider, hasCost: item.costAmount !== null } });
      return this.serialize(item);
    });
  }

  async runProvider(id: string) {
    const item = await this.find(id);
    if (!openStatuses.includes(item.status)) throw new ConflictException("Diese Recherche kann nicht erneut ausgeführt werden.");
    if (item.provider === AddressResearchProviderType.MANUAL) throw new BadRequestException("Manuelle Recherchen werden durch Ergebniserfassung bearbeitet.");
    const results = await this.providers.search(item.provider, { partyId: item.partyId, processingRestricted: Boolean(item.party.processingRestrictedAt), originalAddress: item.originalStreet && item.originalPostalCode && item.originalCity && item.originalCountry ? { street: item.originalStreet, houseNumber: item.originalHouseNumber, postalCode: item.originalPostalCode, city: item.originalCity, country: item.originalCountry } : null });
    if (!results.length) return this.noResult(id);
    for (const result of results) await this.addResult(id, result);
    return this.get(id);
  }

  async addResult(id: string, dto: AddAddressResearchResultDto) {
    const item = await this.find(id);
    if (!openStatuses.includes(item.status)) throw new ConflictException("Zu dieser abgeschlossenen Recherche können keine Ergebnisse ergänzt werden.");
    const actorId = this.tenant.getStaffContext().tenantMembershipId;
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.addressResearchResult.create({ data: { tenantId: item.tenantId, researchRequestId: item.id, street: dto.street.trim(), houseNumber: dto.houseNumber?.trim() || undefined, postalCode: dto.postalCode.trim(), city: dto.city.trim(), country: dto.country.toUpperCase(), additionalAddressLine: dto.additionalAddressLine?.trim() || undefined, source: dto.source.trim(), sourceReference: dto.sourceReference?.trim() || undefined, sourceDate: dto.sourceDate ? new Date(dto.sourceDate) : undefined, confidence: dto.confidence, qualityReason: dto.qualityReason?.trim() || undefined } });
      await tx.addressResearchRequest.update({ where: { id: item.id }, data: { status: dto.confidence === "LOW" ? AddressResearchStatus.REVIEW_REQUIRED : AddressResearchStatus.RESULT_AVAILABLE, resultCount: { increment: 1 } } });
      await this.activity.recordStaffEvent(tx, actorId, { tenantId: item.tenantId, partyId: item.partyId, caseId: item.caseId ?? undefined, eventType: ActivityEventType.ADDRESS_RESEARCH_RESULT_ADDED, sourceEntityType: "AddressResearchResult", sourceEntityId: result.id, metadata: { requestId: item.id, confidence: result.confidence, source: result.source } });
      return result;
    });
  }

  async noResult(id: string, note?: string) {
    const item = await this.find(id);
    if (!openStatuses.includes(item.status)) throw new ConflictException("Diese Recherche ist bereits abgeschlossen.");
    if (item.resultCount > 0) throw new ConflictException("Eine Recherche mit gespeicherten Treffern kann nicht als ergebnislos abgeschlossen werden.");
    const actorId = this.tenant.getStaffContext().tenantMembershipId;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.addressResearchRequest.update({ where: { id: item.id }, data: { status: AddressResearchStatus.NO_RESULT, completedAt: new Date(), notes: note?.trim() || item.notes } });
      await this.activity.recordStaffEvent(tx, actorId, { tenantId: item.tenantId, partyId: item.partyId, caseId: item.caseId ?? undefined, eventType: ActivityEventType.ADDRESS_RESEARCH_NO_RESULT, sourceEntityType: "AddressResearchRequest", sourceEntityId: item.id });
      return updated;
    });
  }

  async cancel(id: string, note?: string) {
    const item = await this.find(id);
    if (!openStatuses.includes(item.status)) throw new ConflictException("Diese Recherche kann nicht abgebrochen werden.");
    const actorId = this.tenant.getStaffContext().tenantMembershipId;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.addressResearchRequest.update({ where: { id: item.id }, data: { status: AddressResearchStatus.CANCELLED, completedAt: new Date(), notes: note?.trim() || item.notes } });
      await this.activity.recordStaffEvent(tx, actorId, { tenantId: item.tenantId, partyId: item.partyId, caseId: item.caseId ?? undefined, eventType: ActivityEventType.ADDRESS_RESEARCH_CANCELLED, sourceEntityType: "AddressResearchRequest", sourceEntityId: item.id });
      return updated;
    });
  }

  async apply(id: string, resultId: string) {
    const tenantId = await this.tenant.getTenantId();
    const actorId = this.tenant.getStaffContext().tenantMembershipId;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`address-research:${id}`}))`;
      const item = await tx.addressResearchRequest.findFirst({ where: { id, tenantId }, include: { results: true, party: { include: { roles: { where: { deletedAt: null } }, addresses: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] } } } } });
      if (!item) throw new NotFoundException("Adressermittlung wurde nicht gefunden.");
      if (!item.party.roles.some((role) => role.role === PartyRoleType.DEBTOR)) throw new ConflictException("Adressermittlungen sind nur für Schuldner zulässig.");
      if (!openStatuses.includes(item.status)) throw new ConflictException("Aus dieser abgeschlossenen Recherche kann keine Adresse übernommen werden.");
      const result = item.results.find((value) => value.id === resultId);
      if (!result) throw new NotFoundException("Rechercheergebnis wurde nicht gefunden.");
      const current = this.currentAddress(item.party.addresses);
      const sameAddress = current ? this.addressKey(current) === this.addressKey(result) : false;
      if (!sameAddress) {
        await tx.address.updateMany({ where: { partyId: item.partyId, deletedAt: null, isPrimary: true }, data: { isPrimary: false, type: AddressType.PREVIOUS } });
        await tx.address.create({ data: { partyId: item.partyId, type: AddressType.PRIMARY, street: result.street, houseNumber: result.houseNumber, addressLine2: result.additionalAddressLine, postalCode: result.postalCode, city: result.city, country: result.country, isPrimary: true } });
      }
      await tx.addressResearchResult.updateMany({ where: { researchRequestId: item.id }, data: { isSelected: false } });
      await tx.addressResearchResult.update({ where: { id: result.id }, data: { isSelected: true, appliedAt: new Date(), appliedByMembershipId: actorId } });
      await tx.addressResearchRequest.update({ where: { id: item.id }, data: { selectedResultId: result.id, status: AddressResearchStatus.APPLIED, completedAt: new Date() } });
      await this.activity.recordStaffEvent(tx, actorId, { tenantId, partyId: item.partyId, caseId: item.caseId ?? undefined, eventType: ActivityEventType.ADDRESS_RESEARCH_RESULT_SELECTED, sourceEntityType: "AddressResearchResult", sourceEntityId: result.id, metadata: { requestId: item.id } });
      await this.activity.recordStaffEvent(tx, actorId, { tenantId, partyId: item.partyId, caseId: item.caseId ?? undefined, eventType: ActivityEventType.ADDRESS_RESEARCH_ADDRESS_APPLIED, description: sameAddress ? "Bestehende Anschrift wurde bestätigt." : "Neue Anschrift wurde kontrolliert übernommen.", sourceEntityType: "AddressResearchResult", sourceEntityId: result.id, metadata: { requestId: item.id, sameAddress } });
      return { sameAddress, request: await tx.addressResearchRequest.findUniqueOrThrow({ where: { id: item.id }, include: detailInclude }) };
    }).then(({ sameAddress, request }) => ({ sameAddress, request: this.serialize(request) }));
  }

  private async find(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const item = await this.prisma.addressResearchRequest.findFirst({ where: { id, tenantId }, include: detailInclude });
    if (!item) throw new NotFoundException("Adressermittlung wurde nicht gefunden.");
    return item;
  }

  private async assertDebtor(tenantId: string, partyId: string) {
    const party = await this.prisma.party.findFirst({ where: { id: partyId, tenantId, deletedAt: null, roles: { some: { role: PartyRoleType.DEBTOR, deletedAt: null } } }, include: { addresses: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] } } });
    if (!party) throw new BadRequestException("Adressermittlungen sind nur für Schuldner des aktuellen Mandanten zulässig.");
    return party;
  }

  private async assertCase(tenantId: string, caseId: string, partyId: string) {
    const value = await this.prisma.case.findFirst({ where: { id: caseId, tenantId, debtorPartyId: partyId, deletedAt: null }, select: { id: true } });
    if (!value) throw new BadRequestException("Die ausgewählte Akte gehört nicht zu diesem Schuldner.");
  }

  private currentAddress(addresses: Array<{ id: string; street: string; houseNumber: string | null; addressLine2: string | null; postalCode: string; city: string; country: string; isPrimary: boolean }>) {
    return addresses.find((address) => address.isPrimary) ?? addresses[0] ?? null;
  }

  private addressKey(address: { street: string; houseNumber: string | null; postalCode: string; city: string; country: string }) {
    const normalize = (value: string | null) => (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
    return [address.street, address.houseNumber, address.postalCode, address.city, address.country].map(normalize).join("|");
  }

  private serialize<T extends Prisma.AddressResearchRequestGetPayload<{ include: typeof detailInclude }>>(item: T) {
    return { ...item, costAmount: item.costAmount?.toFixed(2) ?? null };
  }
}
