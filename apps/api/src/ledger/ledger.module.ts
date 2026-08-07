import { Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";

@Module({
  imports: [CoreModule],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
