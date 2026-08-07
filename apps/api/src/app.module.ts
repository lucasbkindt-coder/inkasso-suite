import { Module } from "@nestjs/common";

import { CoreModule } from "./core/core.module";
import { CasesModule } from "./cases/cases.module";
import { DebtorsModule } from "./debtors/debtors.module";
import { PartiesModule } from "./parties/parties.module";

@Module({ imports: [CoreModule, DebtorsModule, PartiesModule, CasesModule] })
export class AppModule {}
