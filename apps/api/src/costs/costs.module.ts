import { Module } from "@nestjs/common";
import { LegalReferencesModule } from "../legal-references/legal-references.module";
import { LedgerModule } from "../ledger/ledger.module";
import { CaseCostsController, CostsController } from "./costs.controller";
import { CostsService } from "./costs.service";
@Module({
  imports: [LegalReferencesModule, LedgerModule],
  controllers: [CostsController, CaseCostsController],
  providers: [CostsService],
})
export class CostsModule {}
