import { Module } from "@nestjs/common";

import { CoreModule } from "./core/core.module";
import { CasesModule } from "./cases/cases.module";
import { CostsModule } from "./costs/costs.module";
import { DebtorsModule } from "./debtors/debtors.module";
import { LedgerModule } from "./ledger/ledger.module";
import { LegalReferencesModule } from "./legal-references/legal-references.module";
import { PartiesModule } from "./parties/parties.module";

@Module({
  imports: [
    CoreModule,
    DebtorsModule,
    PartiesModule,
    CasesModule,
    LedgerModule,
    LegalReferencesModule,
    CostsModule,
  ],
})
export class AppModule {}
