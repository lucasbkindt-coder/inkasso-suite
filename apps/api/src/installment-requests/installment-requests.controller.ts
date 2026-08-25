import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { InstallmentRequestStatus } from "@prisma/client";
import { readCookie } from "../portal-auth/portal-auth.controller";
import { PORTAL_SESSION_COOKIE } from "../portal-auth/portal-auth.service";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { CreateInstallmentRequestDto } from "./dto/create-installment-request.dto";
import { InstallmentRequestsService } from "./installment-requests.service";

@Controller()
@UseGuards(StaffPermissionGuard)
export class InstallmentRequestsController {
  constructor(private readonly service: InstallmentRequestsService) {}
  @Post("portal/debtor/cases/:caseId/installment-requests")
  createPortal(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CreateInstallmentRequestDto, @Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) { return this.service.createPortal(caseId, dto, previewToken, readCookie(cookie, PORTAL_SESSION_COOKIE)); }
  @Get("portal/debtor/cases/:caseId/installment-requests")
  portalForCase(@Param("caseId", ParseUUIDPipe) caseId: string, @Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) { return this.service.portalForCase(caseId, previewToken, readCookie(cookie, PORTAL_SESSION_COOKIE)); }
  @Get("installment-requests") @RequireStaffPermissions("case:read") list() { return this.service.list(); }
  @Get("installment-requests/:id") @RequireStaffPermissions("case:read") one(@Param("id", ParseUUIDPipe) id: string) { return this.service.one(id); }
  @Post("installment-requests/:id/review") @RequireStaffPermissions("case:update") review(@Param("id", ParseUUIDPipe) id: string) { return this.service.transition(id, InstallmentRequestStatus.UNDER_REVIEW); }
  @Post("installment-requests/:id/approve") @RequireStaffPermissions("case:update") approve(@Param("id", ParseUUIDPipe) id: string) { return this.service.transition(id, InstallmentRequestStatus.APPROVED); }
  @Post("installment-requests/:id/reject") @RequireStaffPermissions("case:update") reject(@Param("id", ParseUUIDPipe) id: string) { return this.service.transition(id, InstallmentRequestStatus.REJECTED); }
}
