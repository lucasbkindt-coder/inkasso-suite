import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";

import { readCookie } from "../portal-auth/portal-auth.controller";
import { PORTAL_SESSION_COOKIE } from "../portal-auth/portal-auth.service";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { InstallmentPlansService } from "./installment-plans.service";
import { CreateStaffInstallmentPlanDto } from "./dto/create-staff-installment-plan.dto";

@Controller()
@UseGuards(StaffPermissionGuard)
export class InstallmentPlansController {
  constructor(private readonly plans: InstallmentPlansService) {}

  @Get("installment-plans") @RequireStaffPermissions("case:read") list() { return this.plans.list(); }
  @Get("installment-plans/:id") @RequireStaffPermissions("case:read") one(@Param("id", ParseUUIDPipe) id: string) { return this.plans.one(id); }
  @Post("installment-requests/:id/create-plan") @RequireStaffPermissions("case:update") create(@Param("id", ParseUUIDPipe) id: string) { return this.plans.createFromRequest(id); }
  @Post("cases/:caseId/installment-plans") @RequireStaffPermissions("case:update") createForCase(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CreateStaffInstallmentPlanDto) { return this.plans.createForCase(caseId, dto); }
  @Post("installment-plans/:id/activate") @RequireStaffPermissions("case:update") activate(@Param("id", ParseUUIDPipe) id: string) { return this.plans.activate(id); }
  @Post("installment-plans/:id/cancel") @RequireStaffPermissions("case:update") cancel(@Param("id", ParseUUIDPipe) id: string) { return this.plans.cancel(id); }
  @Post("installment-plans/:id/default") @RequireStaffPermissions("case:update") default(@Param("id", ParseUUIDPipe) id: string) { return this.plans.default(id); }
  @Get("portal/debtor/cases/:caseId/installment-plan") portal(@Param("caseId", ParseUUIDPipe) caseId: string, @Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) { return this.plans.portal(caseId, previewToken, readCookie(cookie, PORTAL_SESSION_COOKIE)); }
}
