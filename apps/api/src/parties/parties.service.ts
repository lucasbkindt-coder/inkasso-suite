import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityEventType, PartyRoleType, PartyType, Prisma } from "@prisma/client";
import { ActivityService } from "../activity/activity.service";
import { StaffAuthService } from "../staff-auth/staff-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreatePartyDto } from "./dto/create-party.dto";
import { QueryPartiesDto } from "./dto/query-parties.dto";
import { UpdatePartyDto } from "./dto/update-party.dto";
import { markCreditReportsForPartyReview } from "../credit-reporting/credit-report-state";

const detailInclude = {
  person: true,
  company: true,
  roles: { where: { deletedAt: null } },
  addresses: { where: { deletedAt: null }, orderBy: { isPrimary: "desc" } },
  contacts: { where: { deletedAt: null }, orderBy: { isPrimary: "desc" } },
} satisfies Prisma.PartyInclude;

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly staffAuth: StaffAuthService,
    private readonly activity: ActivityService,
  ) {}

  async findAll(query: QueryPartiesDto) {
    const tenantId = await this.tenantContext.getTenantId();
    const where: Prisma.PartyWhereInput = {
      tenantId,
      type: query.type,
      deletedAt: query.includeDeleted ? undefined : null,
    };
    if (query.role) where.roles = { some: { role: query.role, deletedAt: null } };
    if (query.search)
      where.OR = [
        { displayName: { contains: query.search, mode: "insensitive" } },
        {
          person: {
            is: {
              OR: [
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
              ],
            },
          },
        },
        { company: { is: { companyName: { contains: query.search, mode: "insensitive" } } } },
        {
          contacts: {
            some: { deletedAt: null, value: { contains: query.search, mode: "insensitive" } },
          },
        },
        {
          addresses: {
            some: {
              deletedAt: null,
              OR: [
                { city: { contains: query.search, mode: "insensitive" } },
                { postalCode: { contains: query.search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    const [items, total] = await this.prisma.$transaction([
      this.prisma.party.findMany({
        where,
        include: detailInclude,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.party.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string) {
    return this.getParty(id, await this.tenantContext.getTenantId(), true);
  }

  async create(dto: CreatePartyDto) {
    this.validate(dto);
    const tenantId = await this.tenantContext.getTenantId();
    const displayName = this.displayName(dto);
    const actorMembershipId = this.tenantContext.getStaffContext().tenantMembershipId;
    return this.prisma.$transaction(async (tx) => {
      const party = await tx.party.create({
        data: {
          tenantId,
          type: dto.type,
          displayName,
          person:
            dto.type === PartyType.PERSON
              ? {
                  create: {
                    salutation: dto.salutation,
                    title: dto.title,
                    firstName: dto.firstName!,
                    lastName: dto.lastName!,
                    birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
                  },
                }
              : undefined,
          company:
            dto.type === PartyType.COMPANY
              ? {
                  create: {
                    companyName: dto.companyName!,
                    legalForm: dto.legalForm,
                    vatId: dto.vatId,
                    taxNumber: dto.taxNumber,
                    commercialRegister: dto.commercialRegister,
                    registerNumber: dto.registerNumber,
                  },
                }
              : undefined,
          roles: { create: [...new Set(dto.roles)].map((role) => ({ role })) },
          addresses: {
            create: dto.addresses.map((address) => ({
              ...address,
              country: address.country?.toUpperCase(),
            })),
          },
          contacts: { create: dto.contacts },
        },
        include: detailInclude,
      });
      await this.activity.recordStaffEvent(tx, actorMembershipId, {
        tenantId,
        partyId: party.id,
        eventType: ActivityEventType.PARTY_CREATED,
        description: `Partei ${party.displayName} wurde angelegt.`,
        metadata: { partyType: party.type },
        sourceEntityType: "Party",
        sourceEntityId: party.id,
      });
      return party;
    });
  }

  async update(id: string, dto: UpdatePartyDto) {
    const tenantId = await this.tenantContext.getTenantId();
    const existing = await this.getParty(id, tenantId, true);
    if (dto.type !== existing.type)
      throw new BadRequestException("Der Party-Typ kann nicht geändert werden.");
    this.validate(dto);
    const displayName = this.displayName(dto);
    return this.prisma.$transaction(async (tx) => {
      if (dto.roles) {
        await tx.partyRole.updateMany({
          where: { partyId: id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        for (const role of new Set(dto.roles))
          await tx.partyRole.upsert({
            where: { partyId_role: { partyId: id, role } },
            update: { deletedAt: null },
            create: { partyId: id, role },
          });
      }
      if (dto.addresses) {
        await tx.address.updateMany({
          where: { partyId: id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        await tx.address.createMany({
          data: dto.addresses.map((address) => ({
            partyId: id,
            ...address,
            country: address.country?.toUpperCase(),
          })),
        });
      }
      if (dto.contacts) {
        await tx.contact.updateMany({
          where: { partyId: id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        await tx.contact.createMany({
          data: dto.contacts.map((contact) => ({ partyId: id, ...contact })),
        });
      }
      if (dto.type === PartyType.PERSON)
        await tx.person.update({
          where: { partyId: id },
          data: {
            salutation: dto.salutation,
            title: dto.title,
            firstName: dto.firstName!,
            lastName: dto.lastName!,
            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          },
        });
      if (dto.type === PartyType.COMPANY)
        await tx.company.update({
          where: { partyId: id },
          data: {
            companyName: dto.companyName!,
            legalForm: dto.legalForm,
            vatId: dto.vatId,
            taxNumber: dto.taxNumber,
            commercialRegister: dto.commercialRegister,
            registerNumber: dto.registerNumber,
          },
        });
      const party = await tx.party.update({ where: { id }, data: { displayName }, include: detailInclude });
      const changedFields = Object.keys(dto);
      const eventType = dto.addresses && changedFields.length === 2 && changedFields.includes("type")
        ? ActivityEventType.PARTY_ADDRESS_UPDATED
        : dto.contacts && changedFields.length === 2 && changedFields.includes("type")
          ? ActivityEventType.PARTY_CONTACT_UPDATED
          : ActivityEventType.PARTY_UPDATED;
      await this.activity.recordStaffEvent(tx, this.tenantContext.getStaffContext().tenantMembershipId, {
        tenantId,
        partyId: id,
        eventType,
        description: eventType === ActivityEventType.PARTY_ADDRESS_UPDATED
          ? "Anschrift wurde aktualisiert."
          : eventType === ActivityEventType.PARTY_CONTACT_UPDATED
            ? "Kontaktdaten wurden aktualisiert."
            : "Partei wurde bearbeitet.",
        metadata: { changedFields },
        sourceEntityType: "Party",
        sourceEntityId: id,
      });
      if (dto.addresses) await markCreditReportsForPartyReview(tx, { tenantId, partyId: id, reasonCode: "ADDRESS_CHANGED", actorMembershipId: this.tenantContext.getStaffContext().tenantMembershipId });
      return party;
    });
  }

  async remove(id: string) {
    const tenantId = await this.tenantContext.getTenantId();
    await this.getParty(id, tenantId, false);
    return this.prisma.party.update({ where: { id }, data: { deletedAt: new Date() } });
  }
  async restore(id: string) {
    const tenantId = await this.tenantContext.getTenantId();
    const party = await this.prisma.party.findFirst({
      where: { id, tenantId, deletedAt: { not: null } },
    });
    if (!party) throw new NotFoundException("Gelöschte Partei wurde nicht gefunden.");
    return this.prisma.party.update({ where: { id }, data: { deletedAt: null } });
  }

  async activities(id: string, page = 1, limit = 25) {
    const tenantId = await this.tenantContext.getTenantId();
    this.staffAuth.requirePermission(this.tenantContext.getStaffContext(), "debtor:read");
    await this.getParty(id, tenantId, true);
    return this.activity.listForParty(tenantId, id, page, limit);
  }

  private async getParty(id: string, tenantId: string, active: boolean) {
    const party = await this.prisma.party.findFirst({
      where: { id, tenantId, deletedAt: active ? null : undefined },
      include: detailInclude,
    });
    if (!party) throw new NotFoundException("Partei wurde nicht gefunden.");
    return party;
  }
  private validate(dto: CreatePartyDto) {
    if (dto.type === PartyType.PERSON && (!dto.firstName?.trim() || !dto.lastName?.trim()))
      throw new BadRequestException("Vor- und Nachname sind für Personen erforderlich.");
    if (dto.type === PartyType.COMPANY && !dto.companyName?.trim())
      throw new BadRequestException("Firmenname ist für Unternehmen erforderlich.");
    if (dto.addresses.filter((item) => item.isPrimary).length > 1)
      throw new BadRequestException("Es ist nur eine primäre Adresse erlaubt.");
    for (const type of Object.values(PartyRoleType)) void type;
    const primaryContacts = new Set<string>();
    for (const contact of dto.contacts.filter((item) => item.isPrimary)) {
      if (primaryContacts.has(contact.type))
        throw new BadRequestException("Es ist je Kontakttyp nur ein primärer Kontakt erlaubt.");
      primaryContacts.add(contact.type);
    }
  }
  private displayName(dto: CreatePartyDto) {
    return (
      dto.displayName?.trim() ||
      (dto.type === PartyType.PERSON ? `${dto.firstName} ${dto.lastName}` : dto.companyName!)
    );
  }
}
