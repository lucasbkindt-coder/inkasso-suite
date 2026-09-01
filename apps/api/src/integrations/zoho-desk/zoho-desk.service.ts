import { ConflictException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ExternalIntegrationEntityType,
  IntegrationProvider,
  PartyRoleType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { TenantContextService } from "../../tenant/tenant-context.service";
import { ZohoDeskClient } from "./zoho-desk.client";
import { ZohoDeskConfigService } from "./zoho-desk.config";

type ConnectionState = {
  connected: boolean | null;
  organizationReachable: boolean | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

@Injectable()
export class ZohoDeskService {
  private connection: ConnectionState = {
    connected: null,
    organizationReachable: null,
    lastCheckedAt: null,
    lastError: null,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly config: ZohoDeskConfigService,
    private readonly client: ZohoDeskClient,
  ) {}

  status() {
    return { ...this.config.status(), ...this.connection };
  }

  async testConnection() {
    const configurationStatus = this.config.status();
    const checkedAt = new Date().toISOString();
    if (!configurationStatus.configured) {
      this.connection = {
        connected: false,
        organizationReachable: false,
        lastCheckedAt: checkedAt,
        lastError:
          configurationStatus.configurationError ?? "Zoho Desk ist nicht vollständig konfiguriert.",
      };
      return this.status();
    }
    try {
      const organizationId = this.config.require().orgId;
      const organizations = await this.client.organizations();
      const organizationReachable = organizations.some(
        (item) => String(item.id) === organizationId,
      );
      this.connection = {
        connected: true,
        organizationReachable,
        lastCheckedAt: checkedAt,
        lastError: organizationReachable
          ? null
          : "Die konfigurierte Zoho-Organisation wurde nicht gefunden.",
      };
    } catch (error) {
      this.connection = {
        connected: false,
        organizationReachable: false,
        lastCheckedAt: checkedAt,
        lastError: this.safeMessage(error),
      };
    }
    return this.status();
  }

  searchContacts(query: string) {
    return this.client.searchContacts(query.trim());
  }

  searchTickets(query: string) {
    return this.client.searchTickets(query.trim());
  }

  async partyContactLink(partyId: string) {
    const tenantId = await this.tenant.getTenantId();
    await this.assertParty(tenantId, partyId);
    return this.prisma.externalIntegrationLink.findFirst({
      where: {
        tenantId,
        partyId,
        provider: IntegrationProvider.ZOHO_DESK,
        entityType: ExternalIntegrationEntityType.PARTY_CONTACT,
      },
      select: { id: true, externalId: true, metadata: true, createdAt: true, updatedAt: true },
    });
  }

  async linkPartyContact(partyId: string, externalId: string) {
    const tenantId = await this.tenant.getTenantId();
    await this.assertParty(tenantId, partyId);
    const contact = await this.client.contactById(externalId);
    try {
      return await this.prisma.externalIntegrationLink.create({
        data: {
          tenantId,
          partyId,
          provider: IntegrationProvider.ZOHO_DESK,
          entityType: ExternalIntegrationEntityType.PARTY_CONTACT,
          externalId: contact.id,
          metadata: this.contactSnapshot(contact),
        },
        select: { id: true, externalId: true, metadata: true, createdAt: true, updatedAt: true },
      });
    } catch (error) {
      if (this.isUniqueConstraint(error))
        throw new ConflictException("Dieser Zoho-Kontakt oder diese Partei ist bereits verknüpft.");
      throw error;
    }
  }

  async unlinkPartyContact(partyId: string, linkId: string) {
    const tenantId = await this.tenant.getTenantId();
    const link = await this.prisma.externalIntegrationLink.findFirst({
      where: {
        id: linkId,
        tenantId,
        partyId,
        provider: IntegrationProvider.ZOHO_DESK,
        entityType: ExternalIntegrationEntityType.PARTY_CONTACT,
      },
      select: { id: true },
    });
    if (!link) throw new NotFoundException("Die Zoho-Verknüpfung wurde nicht gefunden.");
    await this.prisma.externalIntegrationLink.delete({ where: { id: link.id } });
  }

  async caseTicketLinks(caseId: string) {
    const tenantId = await this.tenant.getTenantId();
    await this.assertCase(tenantId, caseId);
    const links = await this.prisma.externalIntegrationLink.findMany({
      where: {
        tenantId,
        caseId,
        provider: IntegrationProvider.ZOHO_DESK,
        entityType: ExternalIntegrationEntityType.CASE_TICKET,
      },
      select: { id: true, externalId: true, metadata: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    });
    return links.map((link) => ({ ...link, webUrl: this.safeTicketUrl(link.externalId) }));
  }

  async linkCaseTicket(caseId: string, externalId: string) {
    const tenantId = await this.tenant.getTenantId();
    await this.assertCase(tenantId, caseId);
    const ticket = await this.client.ticketById(externalId);
    try {
      const link = await this.prisma.externalIntegrationLink.create({
        data: {
          tenantId,
          caseId,
          provider: IntegrationProvider.ZOHO_DESK,
          entityType: ExternalIntegrationEntityType.CASE_TICKET,
          externalId: ticket.id,
          metadata: this.ticketSnapshot(ticket),
        },
        select: { id: true, externalId: true, metadata: true, createdAt: true, updatedAt: true },
      });
      return { ...link, webUrl: ticket.webUrl };
    } catch (error) {
      if (this.isUniqueConstraint(error))
        throw new ConflictException("Dieses Zoho-Ticket ist bereits verknüpft.");
      throw error;
    }
  }

  async unlinkCaseTicket(caseId: string, linkId: string) {
    const tenantId = await this.tenant.getTenantId();
    const link = await this.prisma.externalIntegrationLink.findFirst({
      where: {
        id: linkId,
        tenantId,
        caseId,
        provider: IntegrationProvider.ZOHO_DESK,
        entityType: ExternalIntegrationEntityType.CASE_TICKET,
      },
      select: { id: true },
    });
    if (!link) throw new NotFoundException("Die Zoho-Verknüpfung wurde nicht gefunden.");
    await this.prisma.externalIntegrationLink.delete({ where: { id: link.id } });
  }

  private async assertParty(tenantId: string, partyId: string) {
    const party = await this.prisma.party.findFirst({
      where: {
        id: partyId,
        tenantId,
        deletedAt: null,
        roles: {
          some: { role: { in: [PartyRoleType.CLIENT, PartyRoleType.DEBTOR] }, deletedAt: null },
        },
      },
      select: { id: true },
    });
    if (!party)
      throw new NotFoundException(
        "Partei wurde nicht gefunden oder ist nicht für Zoho Desk freigegeben.",
      );
  }

  private async assertCase(tenantId: string, caseId: string) {
    const item = await this.prisma.case.findFirst({
      where: { id: caseId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!item) throw new NotFoundException("Inkassoakte wurde nicht gefunden.");
  }

  private contactSnapshot(contact: Awaited<ReturnType<ZohoDeskClient["contactById"]>>) {
    return {
      displayName: contact.displayName,
      email: contact.email,
      phone: contact.phone,
      mobile: contact.mobile,
    } satisfies Prisma.InputJsonObject;
  }

  private ticketSnapshot(ticket: Awaited<ReturnType<ZohoDeskClient["ticketById"]>>) {
    return {
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      contact: ticket.contact,
      createdTime: ticket.createdTime,
      modifiedTime: ticket.modifiedTime,
    } satisfies Prisma.InputJsonObject;
  }

  private safeTicketUrl(externalId: string) {
    try {
      return this.config.ticketWebUrl(externalId);
    } catch {
      return null;
    }
  }

  private safeMessage(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === "string") return response;
      if (response && typeof response === "object" && "message" in response) {
        const message = (response as { message?: unknown }).message;
        if (typeof message === "string") return message;
      }
    }
    return "Die Zoho-Verbindung konnte nicht geprüft werden.";
  }

  private isUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
