import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";

import { CreateLedgerEntryDto } from "./dto/create-ledger-entry.dto";
import { LedgerService } from "./ledger.service";

@Controller("cases")
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get(":caseId/ledger")
  findAll(@Param("caseId", ParseUUIDPipe) caseId: string) {
    return this.ledgerService.findAll(caseId);
  }

  @Post(":caseId/ledger")
  create(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CreateLedgerEntryDto) {
    return this.ledgerService.create(caseId, dto);
  }

  @Post(":caseId/ledger/:entryId/reverse")
  reverse(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("entryId", ParseUUIDPipe) entryId: string,
  ) {
    return this.ledgerService.reverse(caseId, entryId);
  }
}
