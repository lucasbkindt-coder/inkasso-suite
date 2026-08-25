import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { DebtorsService } from "./debtors.service";
import { CreateDebtorDto } from "./dto/create-debtor.dto";
import { QueryDebtorsDto } from "./dto/query-debtors.dto";
import { UpdateDebtorDto } from "./dto/update-debtor.dto";

@Controller("debtors")
@UseGuards(StaffPermissionGuard)
export class DebtorsController {
  constructor(private readonly debtorsService: DebtorsService) {}
  @Post() @RequireStaffPermissions("debtor:create") create(@Body() dto: CreateDebtorDto) {
    return this.debtorsService.create(dto);
  }
  @Get() @RequireStaffPermissions("debtor:read") findAll(@Query() query: QueryDebtorsDto) {
    return this.debtorsService.findAll(query);
  }
  @Get(":id") @RequireStaffPermissions("debtor:read") findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.debtorsService.findOne(id);
  }
  @Patch(":id") @RequireStaffPermissions("debtor:update") update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateDebtorDto) {
    return this.debtorsService.update(id, dto);
  }
  @Delete(":id") @HttpCode(204) @RequireStaffPermissions("debtor:update") remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.debtorsService.remove(id);
  }
}
