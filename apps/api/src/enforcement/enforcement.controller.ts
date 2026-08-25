import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { CreateEnforcementActionDto, CreateEnforcementTitleDto, UpdateEnforcementActionStatusDto, UpdateEnforcementTitleStatusDto } from "./enforcement.dto";
import { EnforcementService } from "./enforcement.service";

@Controller("cases/:caseId/enforcement") @UseGuards(StaffPermissionGuard)
export class EnforcementController {
  constructor(private readonly service: EnforcementService) {}
  @Get("titles") @RequireStaffPermissions("claim:read") titles(@Param("caseId", ParseUUIDPipe) id: string) { return this.service.titles(id); }
  @Post("titles") @RequireStaffPermissions("case:update") createTitle(@Param("caseId", ParseUUIDPipe) id: string, @Body() dto: CreateEnforcementTitleDto) { return this.service.createTitle(id, dto); }
  @Patch("titles/:titleId/status") @RequireStaffPermissions("case:update") titleStatus(@Param("caseId", ParseUUIDPipe) caseId: string, @Param("titleId", ParseUUIDPipe) titleId: string, @Body() dto: UpdateEnforcementTitleStatusDto) { return this.service.updateTitleStatus(caseId, titleId, dto.status); }
  @Get("actions") @RequireStaffPermissions("claim:read") actions(@Param("caseId", ParseUUIDPipe) id: string) { return this.service.actions(id); }
  @Post("actions") @RequireStaffPermissions("case:update") createAction(@Param("caseId", ParseUUIDPipe) id: string, @Body() dto: CreateEnforcementActionDto) { return this.service.createAction(id, dto); }
  @Patch("actions/:actionId/status") @RequireStaffPermissions("case:update") actionStatus(@Param("caseId", ParseUUIDPipe) caseId: string, @Param("actionId", ParseUUIDPipe) actionId: string, @Body() dto: UpdateEnforcementActionStatusDto) { return this.service.updateActionStatus(caseId, actionId, dto.status); }
}
