import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { PortalPreviewService } from "./portal-preview.service";
@Controller("portal-preview")
@UseGuards(StaffPermissionGuard)
export class PortalPreviewController {
  constructor(private readonly previews: PortalPreviewService) {}
  @Post("client/:partyId") @RequireStaffPermissions("debtor:read") client(@Param("partyId", ParseUUIDPipe) partyId: string) { return this.previews.createClient(partyId); }
  @Post("debtor/:partyId") @RequireStaffPermissions("debtor:read") debtor(@Param("partyId", ParseUUIDPipe) partyId: string) { return this.previews.createDebtor(partyId); }
  @Post("debtor-case/:caseId") @RequireStaffPermissions("case:read") case(@Param("caseId", ParseUUIDPipe) caseId: string) { return this.previews.createDebtorCase(caseId); }
}
