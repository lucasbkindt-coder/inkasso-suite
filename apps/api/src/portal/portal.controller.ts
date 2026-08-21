import { Controller, Get, Headers, Param, ParseUUIDPipe, Res } from "@nestjs/common";

import { readCookie } from "../portal-auth/portal-auth.controller";
import { PORTAL_SESSION_COOKIE } from "../portal-auth/portal-auth.service";
import { PortalService } from "./portal.service";

type DownloadResponse = {
  setHeader(name: string, value: string): void;
  send(buffer: Buffer): void;
};

@Controller("portal")
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get("context")
  context(@Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) {
    return this.portal.context({ previewToken, sessionToken: readCookie(cookie, PORTAL_SESSION_COOKIE) });
  }

  @Get("client/summary")
  clientSummary(@Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) {
    return this.portal.clientSummary({ previewToken, sessionToken: readCookie(cookie, PORTAL_SESSION_COOKIE) });
  }

  @Get("client/cases")
  clientCases(@Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) {
    return this.portal.clientCasesRequest({ previewToken, sessionToken: readCookie(cookie, PORTAL_SESSION_COOKIE) });
  }

  @Get("client/cases/:id")
  clientCase(@Param("id", ParseUUIDPipe) id: string, @Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) {
    return this.portal.clientCase(id, { previewToken, sessionToken: readCookie(cookie, PORTAL_SESSION_COOKIE) });
  }

  @Get("debtor/summary")
  debtorSummary(@Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) {
    return this.portal.debtorSummary({ previewToken, sessionToken: readCookie(cookie, PORTAL_SESSION_COOKIE) });
  }

  @Get("debtor/cases/:id")
  debtorCase(@Param("id", ParseUUIDPipe) id: string, @Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) {
    return this.portal.debtorCase(id, { previewToken, sessionToken: readCookie(cookie, PORTAL_SESSION_COOKIE) });
  }

  @Get("debtor/claim")
  debtorClaim(@Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) {
    return this.portal.debtorClaim({ previewToken, sessionToken: readCookie(cookie, PORTAL_SESSION_COOKIE) });
  }

  @Get("debtor/documents")
  debtorDocuments(@Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) {
    return this.portal.debtorDocuments({ previewToken, sessionToken: readCookie(cookie, PORTAL_SESSION_COOKIE) });
  }

  @Get("documents/:id/download")
  async download(@Param("id", ParseUUIDPipe) id: string, @Headers("x-risepay-portal-preview") previewToken: string | undefined, @Headers("cookie") cookie: string | undefined, @Res() response: DownloadResponse) {
    const file = await this.portal.downloadDocument(id, { previewToken, sessionToken: readCookie(cookie, PORTAL_SESSION_COOKIE) });
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.filename.replace(/\"/g, "")}"`);
    response.send(file.buffer);
  }
}
