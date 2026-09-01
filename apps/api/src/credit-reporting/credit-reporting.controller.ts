import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { CreditReportingService } from "./credit-reporting.service";
import { CreateCreditBureauReportDto, CreditBureauReasonDto, QueryCreditBureauReportsDto } from "./dto";

@Controller("credit-reports")
@UseGuards(StaffPermissionGuard)
export class CreditReportingController {
  constructor(private readonly service: CreditReportingService) {}
  @Get() @RequireStaffPermissions("credit-report:read") list(@Query() query: QueryCreditBureauReportsDto) { return this.service.list(query); }
  @Get("options") @RequireStaffPermissions("credit-report:read") options() { return this.service.options(); }
  @Get(":id") @RequireStaffPermissions("credit-report:read") get(@Param("id", ParseUUIDPipe) id: string) { return this.service.get(id); }
  @Post() @RequireStaffPermissions("credit-report:manage") create(@Body() dto: CreateCreditBureauReportDto) { return this.service.create(dto); }
  @Post(":id/eligibility") @RequireStaffPermissions("credit-report:manage") eligibility(@Param("id", ParseUUIDPipe) id: string) { return this.service.checkEligibility(id); }
  @Post(":id/approve") @RequireStaffPermissions("credit-report:approve") approve(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreditBureauReasonDto) { return this.service.approve(id, dto.reason); }
  @Post(":id/revoke") @RequireStaffPermissions("credit-report:approve") revoke(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreditBureauReasonDto) { return this.service.revoke(id, dto.reason); }
  @Post(":id/cancel") @RequireStaffPermissions("credit-report:manage") cancel(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreditBureauReasonDto) { return this.service.cancel(id, dto.reason); }
}
