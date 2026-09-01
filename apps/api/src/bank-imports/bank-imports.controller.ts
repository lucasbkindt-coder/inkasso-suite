import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { BankImportsService } from "./bank-imports.service";
import {
  BankCaseSearchDto,
  BankTransactionQueryDto,
  IgnoreBankTransactionDto,
  ManualBankBookingDto,
} from "./dto";

type UploadFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Controller("bank-imports")
@UseGuards(StaffPermissionGuard)
export class BankImportsController {
  constructor(private readonly bankImports: BankImportsService) {}

  @Post()
  @RequireStaffPermissions("bank-import:manage")
  @UseInterceptors(FileInterceptor("file", { limits: { files: 1, fileSize: 5 * 1024 * 1024 } }))
  upload(@UploadedFile() file?: UploadFile) {
    return this.bankImports.upload(file);
  }

  @Get()
  @RequireStaffPermissions("bank-import:read")
  list() {
    return this.bankImports.listImports();
  }

  @Get("cases/search")
  @RequireStaffPermissions("bank-import:read")
  searchCases(@Query() query: BankCaseSearchDto) {
    return this.bankImports.searchCases(query);
  }

  @Get("transactions")
  @RequireStaffPermissions("bank-import:read")
  transactions(@Query() query: BankTransactionQueryDto) {
    return this.bankImports.listTransactions(query);
  }

  @Get("transactions/:id")
  @RequireStaffPermissions("bank-import:read")
  transaction(@Param("id", ParseUUIDPipe) id: string) {
    return this.bankImports.getTransaction(id);
  }

  @Post("transactions/:id/book")
  @RequireStaffPermissions("bank-import:manage")
  book(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ManualBankBookingDto) {
    return this.bankImports.book(id, dto.caseId);
  }

  @Post("transactions/:id/ignore")
  @RequireStaffPermissions("bank-import:manage")
  ignore(@Param("id", ParseUUIDPipe) id: string, @Body() dto: IgnoreBankTransactionDto) {
    return this.bankImports.ignore(id, dto.reason);
  }

  @Get(":id/download")
  @RequireStaffPermissions("bank-import:read")
  async download(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: { setHeader(name: string, value: string): void; send(buffer: Buffer): void },
  ) {
    const file = await this.bankImports.download(id);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    response.send(file.buffer);
  }
}
