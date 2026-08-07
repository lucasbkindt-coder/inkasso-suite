import { Module } from "@nestjs/common";
import { LegalReferencesModule } from "../legal-references/legal-references.module";
import { CaseCostsController, CostsController } from "./costs.controller";
import { CostsService } from "./costs.service";
@Module({
  imports: [LegalReferencesModule],
  controllers: [CostsController, CaseCostsController],
  providers: [CostsService],
})
export class CostsModule {}
