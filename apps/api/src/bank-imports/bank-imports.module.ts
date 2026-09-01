import { Module } from "@nestjs/common";

import { LedgerModule } from "../ledger/ledger.module";
import { BankImportStorage } from "./bank-import-storage";
import { BankImportsController } from "./bank-imports.controller";
import { BankImportsService } from "./bank-imports.service";
import { BankFileParserService } from "./parsers/bank-file-parser.service";
import { CamtParser } from "./parsers/camt-parser";

@Module({
  imports: [LedgerModule],
  controllers: [BankImportsController],
  providers: [BankImportsService, BankImportStorage, BankFileParserService, CamtParser],
})
export class BankImportsModule {}
