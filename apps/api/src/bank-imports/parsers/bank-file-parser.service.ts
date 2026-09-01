import { Injectable } from "@nestjs/common";

import type { ParsedBankFile } from "./bank-file-parser";
import { CamtParser } from "./camt-parser";

@Injectable()
export class BankFileParserService {
  constructor(private readonly camt: CamtParser) {}

  parse(buffer: Buffer): ParsedBankFile {
    return this.camt.parse(buffer);
  }
}
