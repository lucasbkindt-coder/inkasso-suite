import { Controller, Get, Headers, Param, ParseUUIDPipe, Res } from "@nestjs/common";
import { PortalService } from "./portal.service";

@Controller("portal")
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get("context") context(@Headers("x-risepay-portal-preview") token?: string) { return this.portal.context(token); }
  @Get("client/summary") clientSummary(@Headers("x-risepay-portal-preview") token?: string) { return this.portal.clientSummary(token); }
  @Get("client/cases") clientCases(@Headers("x-risepay-portal-preview") token?: string) { return this.portal.clientCasesRequest(token); }
  @Get("client/cases/:id") clientCase(@Param("id", ParseUUIDPipe) id: string, @Headers("x-risepay-portal-preview") token?: string) { return this.portal.clientCase(id, token); }
  @Get("debtor/summary") debtorSummary(@Headers("x-risepay-portal-preview") token?: string) { return this.portal.debtorSummary(token); }
  @Get("debtor/claim") debtorClaim(@Headers("x-risepay-portal-preview") token?: string) { return this.portal.debtorClaim(token); }
  @Get("debtor/documents") debtorDocuments(@Headers("x-risepay-portal-preview") token?: string) { return this.portal.debtorDocuments(token); }
  @Get("documents/:id/download") async download(@Param("id", ParseUUIDPipe) id: string, @Headers("x-risepay-portal-preview") token: string | undefined, @Res() response: { setHeader(name: string, value: string): void; send(buffer: Buffer): void }) { const file = await this.portal.downloadDocument(id, token); response.setHeader("Content-Type", file.mimeType); response.setHeader("Content-Disposition", `attachment; filename="${file.filename.replace(/\"/g, "")}"`); response.send(file.buffer); }
}
