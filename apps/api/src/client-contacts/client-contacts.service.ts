import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityEventType, PartyRoleType, PortalAccountStatus, PortalAccountType, Prisma } from "@prisma/client";

import { ActivityService } from "../activity/activity.service";
import { PortalAuthService } from "../portal-auth/portal-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateClientContactDto } from "./dto/create-client-contact.dto";
import { UpdateClientContactDto } from "./dto/update-client-contact.dto";

const contactInclude = {
  portalAccount: { select: { id: true, status: true, loginIdentifier: true, activatedAt: true, lastLoginAt: true } },
} satisfies Prisma.ClientContactInclude;

@Injectable()
export class ClientContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly activity: ActivityService,
    private readonly portalAuth: PortalAuthService,
  ) {}

  async list(clientId: string) {
    const tenantId = await this.tenant.getTenantId();
    await this.assertClientParty(tenantId, clientId);
    return this.prisma.clientContact.findMany({
      where: { tenantId, partyId: clientId }, include: contactInclude,
      orderBy: [{ isActive: "desc" }, { isPrimary: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    });
  }

  async create(clientId: string, dto: CreateClientContactDto) {
    const tenantId = await this.tenant.getTenantId();
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    await this.assertClientParty(tenantId, clientId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockClient(tx, clientId);
      if (dto.isPrimary && dto.isActive !== false) await this.clearPrimary(tx, tenantId, clientId);
      const contact = await tx.clientContact.create({
        data: { tenantId, partyId: clientId, createdByMembershipId: actorMembershipId, ...this.createData(dto) },
        include: contactInclude,
      });
      await this.activity.recordStaffEvent(tx, actorMembershipId, {
        tenantId, partyId: clientId, eventType: ActivityEventType.CLIENT_CONTACT_CREATED,
        description: "Ansprechpartner wurde angelegt.", metadata: { clientContactId: contact.id },
        sourceEntityType: "ClientContact", sourceEntityId: contact.id,
      });
      return contact;
    });
  }

  async update(clientId: string, contactId: string, dto: UpdateClientContactDto) {
    const tenantId = await this.tenant.getTenantId();
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    await this.assertClientParty(tenantId, clientId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockClient(tx, clientId);
      const existing = await tx.clientContact.findFirst({ where: { id: contactId, tenantId, partyId: clientId }, include: contactInclude });
      if (!existing) throw new NotFoundException("Ansprechpartner wurde nicht gefunden.");
      const isActive = dto.isActive ?? existing.isActive;
      const isPrimary = dto.isPrimary ?? existing.isPrimary;
      if (isPrimary && !isActive) throw new BadRequestException("Ein inaktiver Ansprechpartner kann nicht Hauptansprechpartner sein.");
      if ((isPrimary && (!existing.isPrimary || dto.isPrimary)) || (!isActive && existing.isPrimary)) {
        await this.clearPrimary(tx, tenantId, clientId);
      }
      const updated = await tx.clientContact.update({
        where: { id: contactId }, data: { ...this.data(dto), isActive, isPrimary: isActive ? isPrimary : false }, include: contactInclude,
      });
      if (!isActive && existing.portalAccount && existing.portalAccount.status !== PortalAccountStatus.LOCKED) {
        await this.portalAuth.suspendAccountInTransaction(tx, tenantId, existing.portalAccount.id, "Der Ansprechpartner wurde deaktiviert.");
      }
      const primaryChanged = existing.isPrimary !== updated.isPrimary;
      await this.activity.recordStaffEvent(tx, actorMembershipId, {
        tenantId, partyId: clientId,
        eventType: primaryChanged ? ActivityEventType.CLIENT_CONTACT_PRIMARY_CHANGED : ActivityEventType.CLIENT_CONTACT_UPDATED,
        description: primaryChanged ? "Hauptansprechpartner wurde geändert." : "Ansprechpartner wurde bearbeitet.",
        metadata: { clientContactId: contactId, changedFields: Object.keys(dto) }, sourceEntityType: "ClientContact", sourceEntityId: contactId,
      });
      return updated;
    });
  }

  async createPortalAccount(clientId: string, contactId: string) {
    const tenantId = await this.tenant.getTenantId();
    await this.assertClientParty(tenantId, clientId);
    const contact = await this.prisma.clientContact.findFirst({ where: { id: contactId, tenantId, partyId: clientId, isActive: true }, include: contactInclude });
    if (!contact) throw new NotFoundException("Aktiver Ansprechpartner wurde nicht gefunden.");
    if (!contact.email) throw new BadRequestException("Für den Portalzugang muss eine E-Mail-Adresse hinterlegt sein.");
    const result = await this.portalAuth.createClientAccountForContact(tenantId, clientId, contactId);
    if (!result.created) throw new ConflictException("Für diesen Ansprechpartner besteht bereits ein Portalzugang.");
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    const activation = await this.portalAuth.issueActivation(tenantId, result.account.id, { actorMembershipId });
    await this.activity.recordStaffEvent(this.prisma, actorMembershipId, {
      tenantId, partyId: clientId, eventType: ActivityEventType.PORTAL_ACCOUNT_CREATED,
      description: "Mandantenportalzugang wurde angelegt.", metadata: { portalAccountId: result.account.id, clientContactId: contactId },
      sourceEntityType: "PortalAccount", sourceEntityId: result.account.id,
    });
    return { account: this.accountResponse(result.account), activation: this.activationResponse(activation) };
  }

  async reissueActivation(portalAccountId: string) {
    const { tenantId, clientContactId } = await this.clientAccount(portalAccountId);
    if (!clientContactId) throw new NotFoundException("Mandantenportalzugang wurde nicht gefunden.");
    const activation = await this.portalAuth.issueActivation(tenantId, portalAccountId, { actorMembershipId: this.tenant.getStaffContext().tenantMembershipId });
    return this.activationResponse(activation);
  }

  async suspendPortalAccount(portalAccountId: string) {
    const account = await this.clientAccount(portalAccountId);
    return this.accountResponse(await this.portalAuth.suspendAccount(account.tenantId, account.id, this.tenant.getStaffContext().tenantMembershipId));
  }

  async reactivatePortalAccount(portalAccountId: string) {
    const account = await this.clientAccount(portalAccountId);
    return this.accountResponse(await this.portalAuth.reactivateAccount(account.tenantId, account.id, this.tenant.getStaffContext().tenantMembershipId));
  }

  private async clientAccount(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const account = await this.prisma.portalAccount.findFirst({ where: { id, tenantId, portalType: PortalAccountType.CLIENT }, select: { id: true, tenantId: true, clientContactId: true } });
    if (!account) throw new NotFoundException("Mandantenportalzugang wurde nicht gefunden.");
    return account;
  }

  private async assertClientParty(tenantId: string, partyId: string) {
    const party = await this.prisma.party.findFirst({ where: { id: partyId, tenantId, deletedAt: null, roles: { some: { role: PartyRoleType.CLIENT, deletedAt: null } } }, select: { id: true } });
    if (!party) throw new BadRequestException("Ansprechpartner können nur für aktive Mandanten angelegt werden.");
  }

  private lockClient(tx: Prisma.TransactionClient, partyId: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`client-contact:${partyId}`}))`;
  }

  private clearPrimary(tx: Prisma.TransactionClient, tenantId: string, partyId: string) {
    return tx.clientContact.updateMany({ where: { tenantId, partyId, isPrimary: true }, data: { isPrimary: false } });
  }

  private data(dto: CreateClientContactDto | UpdateClientContactDto) {
    return {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.salutation !== undefined ? { salutation: dto.salutation?.trim() || null } : {}),
      ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
      ...(dto.position !== undefined ? { position: dto.position?.trim() || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.mobile !== undefined ? { mobile: dto.mobile?.trim() || null } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }

  private createData(dto: CreateClientContactDto) {
    return {
      firstName: dto.firstName.trim(), lastName: dto.lastName.trim(),
      salutation: dto.salutation?.trim() || null, title: dto.title?.trim() || null,
      position: dto.position?.trim() || null, email: dto.email?.trim().toLowerCase() || null,
      phone: dto.phone?.trim() || null, mobile: dto.mobile?.trim() || null,
      notes: dto.notes?.trim() || null, isPrimary: dto.isPrimary, isActive: dto.isActive,
    };
  }

  private activationResponse(activation: { loginIdentifier: string; activationCode: string; expiresAt: Date }) {
    const baseUrl = process.env.PORTAL_PUBLIC_BASE_URL?.trim();
    if (!baseUrl) throw new BadRequestException("PORTAL_PUBLIC_BASE_URL muss für die Portalaktivierung konfiguriert sein.");
    let url: URL;
    try { url = new URL("/portal/aktivieren", baseUrl); } catch { throw new BadRequestException("PORTAL_PUBLIC_BASE_URL ist ungültig."); }
    url.searchParams.set("login", activation.loginIdentifier);
    url.searchParams.set("code", activation.activationCode);
    return { loginIdentifier: activation.loginIdentifier, activationCode: activation.activationCode, activationUrl: url.toString(), expiresAt: activation.expiresAt };
  }

  private accountResponse(account: { id: string; status: PortalAccountStatus; loginIdentifier: string; activatedAt: Date | null; lastLoginAt: Date | null }) {
    return { id: account.id, status: account.status, loginIdentifier: account.loginIdentifier, activatedAt: account.activatedAt, lastLoginAt: account.lastLoginAt };
  }
}
