import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { CostsService } from "./costs.service";
import {
  CaseInterestCostDto,
  CaseRvgCostDto,
  InterestPreviewDto,
  RvgPreviewDto,
} from "./dto/cost-preview.dto";
@Controller("costs")
@UseGuards(StaffPermissionGuard)
export class CostsController {
  constructor(private readonly costs: CostsService) {}
  @Post("rvg/preview") @RequireStaffPermissions("claim:read") rvg(@Body() dto: RvgPreviewDto) {
    return this.costs.rvgPreview(dto);
  }
  @Post("interest/preview") @RequireStaffPermissions("claim:read") interest(@Body() dto: InterestPreviewDto) {
    return this.costs.interestPreview(dto);
  }
}

@Controller("cases")
@UseGuards(StaffPermissionGuard)
export class CaseCostsController {
  constructor(private readonly costs: CostsService) {}

  @Post(":caseId/costs/rvg/preview")
  @RequireStaffPermissions("claim:read")
  rvgPreview(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CaseRvgCostDto) {
    return this.costs.caseRvgPreview(caseId, dto);
  }

  @Post(":caseId/costs/rvg/apply")
  @RequireStaffPermissions("claim:update")
  rvgApply(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CaseRvgCostDto) {
    return this.costs.applyCaseRvg(caseId, dto);
  }

  @Post(":caseId/costs/interest/preview")
  @RequireStaffPermissions("claim:read")
  interestPreview(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() dto: CaseInterestCostDto,
  ) {
    return this.costs.caseInterestPreview(caseId, dto);
  }

  @Post(":caseId/costs/interest/apply")
  @RequireStaffPermissions("claim:update")
  interestApply(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CaseInterestCostDto) {
    return this.costs.applyCaseInterest(caseId, dto);
  }
}
