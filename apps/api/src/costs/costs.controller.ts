import { Body, Controller, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CostsService } from "./costs.service";
import {
  CaseInterestCostDto,
  CaseRvgCostDto,
  InterestPreviewDto,
  RvgPreviewDto,
} from "./dto/cost-preview.dto";
@Controller("costs")
export class CostsController {
  constructor(private readonly costs: CostsService) {}
  @Post("rvg/preview") rvg(@Body() dto: RvgPreviewDto) {
    return this.costs.rvgPreview(dto);
  }
  @Post("interest/preview") interest(@Body() dto: InterestPreviewDto) {
    return this.costs.interestPreview(dto);
  }
}

@Controller("cases")
export class CaseCostsController {
  constructor(private readonly costs: CostsService) {}

  @Post(":caseId/costs/rvg/preview")
  rvgPreview(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CaseRvgCostDto) {
    return this.costs.caseRvgPreview(caseId, dto);
  }

  @Post(":caseId/costs/rvg/apply")
  rvgApply(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CaseRvgCostDto) {
    return this.costs.applyCaseRvg(caseId, dto);
  }

  @Post(":caseId/costs/interest/preview")
  interestPreview(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() dto: CaseInterestCostDto,
  ) {
    return this.costs.caseInterestPreview(caseId, dto);
  }

  @Post(":caseId/costs/interest/apply")
  interestApply(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CaseInterestCostDto) {
    return this.costs.applyCaseInterest(caseId, dto);
  }
}
