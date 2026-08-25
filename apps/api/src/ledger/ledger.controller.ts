import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";

import { CreateLedgerEntryDto } from "./dto/create-ledger-entry.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { LedgerService } from "./ledger.service";

@Controller("cases")
@UseGuards(StaffPermissionGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get(":caseId/ledger")
  @RequireStaffPermissions("case:read")
  findAll(@Param("caseId", ParseUUIDPipe) caseId: string) {
    return this.ledgerService.findAll(caseId);
  }

  @Get(":caseId/payments")
  @RequireStaffPermissions("case:read")
  findPayments(@Param("caseId", ParseUUIDPipe) caseId: string) {
    return this.ledgerService.findPayments(caseId);
  }

  @Post(":caseId/ledger")
  @RequireStaffPermissions("claim:update")
  create(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CreateLedgerEntryDto) {
    return this.ledgerService.create(caseId, dto);
  }

  @Post(":caseId/payments")
  @RequireStaffPermissions("payment:create")
  createPayment(@Param("caseId", ParseUUIDPipe) caseId: string, @Body() dto: CreatePaymentDto) {
    return this.ledgerService.applyPayment(caseId, dto);
  }

  @Post(":caseId/ledger/:entryId/reverse")
  @RequireStaffPermissions("claim:update")
  reverse(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("entryId", ParseUUIDPipe) entryId: string,
  ) {
    return this.ledgerService.reverse(caseId, entryId);
  }
}
