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
} from "@nestjs/common";
import { DebtorsService } from "./debtors.service";
import { CreateDebtorDto } from "./dto/create-debtor.dto";
import { QueryDebtorsDto } from "./dto/query-debtors.dto";
import { UpdateDebtorDto } from "./dto/update-debtor.dto";

@Controller("debtors")
export class DebtorsController {
  constructor(private readonly debtorsService: DebtorsService) {}
  @Post() create(@Body() dto: CreateDebtorDto) {
    return this.debtorsService.create(dto);
  }
  @Get() findAll(@Query() query: QueryDebtorsDto) {
    return this.debtorsService.findAll(query);
  }
  @Get(":id") findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.debtorsService.findOne(id);
  }
  @Patch(":id") update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateDebtorDto) {
    return this.debtorsService.update(id, dto);
  }
  @Delete(":id") @HttpCode(204) remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.debtorsService.remove(id);
  }
}
