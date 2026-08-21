import { Controller, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { PortalPreviewService } from "./portal-preview.service";
@Controller("portal-preview")
export class PortalPreviewController {
  constructor(private readonly previews: PortalPreviewService) {}
  @Post("client/:partyId") client(@Param("partyId", ParseUUIDPipe) partyId: string) { return this.previews.createClient(partyId); }
  @Post("debtor/:partyId") debtor(@Param("partyId", ParseUUIDPipe) partyId: string) { return this.previews.createDebtor(partyId); }
  @Post("debtor-case/:caseId") case(@Param("caseId", ParseUUIDPipe) caseId: string) { return this.previews.createDebtorCase(caseId); }
}
