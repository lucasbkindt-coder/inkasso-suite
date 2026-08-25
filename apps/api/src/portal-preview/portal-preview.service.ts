import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PartyRoleType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";

export type PortalType = "CLIENT" | "DEBTOR";
export type PortalPreview = { tenantId: string; portalType: PortalType; partyId: string; caseId?: string; returnUrl: string; expiresAt: Date };

@Injectable()
export class PortalPreviewService {
  // The preview controller and portal access service can be resolved through
  // separate Nest module paths. Preview state must therefore be shared across
  // service instances within the running API process.
  private static readonly tokens = new Map<string, PortalPreview>();
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService) {}

  async createClient(partyId: string) { return this.createPartyPreview("CLIENT", partyId); }
  async createDebtor(partyId: string) { return this.createPartyPreview("DEBTOR", partyId); }
  async createDebtorCase(caseId: string) {
    const tenantId = await this.tenant.getTenantId();
    const caseRecord = await this.prisma.case.findFirst({ where: { id: caseId, tenantId, deletedAt: null }, select: { debtorPartyId: true } });
    if (!caseRecord) throw new NotFoundException("Inkassoakte wurde nicht gefunden.");
    return this.issue({ tenantId, portalType: "DEBTOR", partyId: caseRecord.debtorPartyId, caseId, returnUrl: `/akten/${caseId}` });
  }
  async require(token: string | undefined, expected: PortalType) {
    const preview = token ? PortalPreviewService.tokens.get(token) : undefined;
    if (!preview || preview.expiresAt <= new Date() || preview.portalType !== expected) {
      if (preview && preview.expiresAt <= new Date() && token) PortalPreviewService.tokens.delete(token);
      throw new UnauthorizedException("Ungültiger oder abgelaufener Portalvorschauzugriff.");
    }
    return preview;
  }
  async context(token: string | undefined) {
    const preview = token ? PortalPreviewService.tokens.get(token) : undefined;
    if (!preview || preview.expiresAt <= new Date()) {
      if (token) PortalPreviewService.tokens.delete(token);
      throw new UnauthorizedException("Ungültiger oder abgelaufener Portalvorschauzugriff.");
    }
    return { portalType: preview.portalType, returnUrl: preview.returnUrl, expiresAt: preview.expiresAt.toISOString() };
  }
  private async createPartyPreview(portalType: PortalType, partyId: string) {
    const tenantId = await this.tenant.getTenantId();
    const party = await this.prisma.party.findFirst({ where: { id: partyId, tenantId, deletedAt: null, roles: { some: { role: portalType === "CLIENT" ? PartyRoleType.CLIENT : PartyRoleType.DEBTOR, deletedAt: null } } }, select: { id: true } });
    if (!party) throw new NotFoundException("Partei ist für diese Portalansicht nicht freigegeben.");
    return this.issue({ tenantId, portalType, partyId, returnUrl: `/parteien/${partyId}` });
  }
  private issue(context: Omit<PortalPreview, "expiresAt">) {
    if (!/^\/(parteien|akten|schuldner)\/[0-9a-f-]+$/i.test(context.returnUrl))
      throw new UnauthorizedException("Ungültiger interner Rücksprungpfad.");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    PortalPreviewService.tokens.set(token, { ...context, expiresAt });
    const base = context.portalType === "CLIENT" ? "/portal/mandant" : "/portal/schuldner";
    return { previewUrl: `${base}?preview=${encodeURIComponent(token)}`, expiresAt: expiresAt.toISOString() };
  }
}
