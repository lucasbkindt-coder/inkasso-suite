import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PortalAccountType } from "@prisma/client";

import { PortalPreviewService, type PortalType } from "../portal-preview/portal-preview.service";
import { PortalAuthService, type PortalAuthContext } from "./portal-auth.service";

export type PortalAccessContext = Omit<PortalAuthContext, "portalAccountId"> & {
  mode: "AUTHENTICATED" | "PREVIEW";
  caseId?: string;
  returnUrl?: string;
};

@Injectable()
export class PortalAccessService {
  constructor(
    private readonly previews: PortalPreviewService,
    private readonly auth: PortalAuthService,
  ) {}

  async resolve(
    previewToken: string | undefined,
    sessionToken: string | undefined,
    expectedType: PortalType,
  ): Promise<PortalAccessContext> {
    if (previewToken) {
      const preview = await this.previews.require(previewToken, expectedType);
      return {
        tenantId: preview.tenantId,
        portalType: preview.portalType,
        partyId: preview.partyId,
        mode: "PREVIEW",
        caseId: preview.caseId,
        returnUrl: preview.returnUrl,
      };
    }
    const context = await this.auth.requireSession(
      sessionToken,
      expectedType as PortalAccountType | undefined,
    );
    return {
      tenantId: context.tenantId,
      portalType: context.portalType,
      partyId: context.partyId,
      mode: "AUTHENTICATED",
    };
  }

  missingContext(): never {
    throw new UnauthorizedException("Portal-Anmeldung erforderlich.");
  }
}
