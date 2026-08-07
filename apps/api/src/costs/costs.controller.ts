import { Body, Controller, Post } from "@nestjs/common";
import { CostsService } from "./costs.service";
import { InterestPreviewDto, RvgPreviewDto } from "./dto/cost-preview.dto";
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
