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

import { CasesService } from "./cases.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { QueryCasesDto } from "./dto/query-cases.dto";
import { UpdateCaseDto } from "./dto/update-case.dto";
import { AssignCaseDto } from "./dto/assign-case.dto";
import { TransitionCaseStatusDto } from "./dto/transition-case-status.dto";

@Controller("cases")
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  findAll(@Query() query: QueryCasesDto) {
    return this.casesService.findAll(query);
  }

  @Get("by-number")
  findByNumber(@Query("caseNumber") caseNumber: string) {
    return this.casesService.findByNumber(caseNumber);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.casesService.findOne(id);
  }

  @Get(":id/status-transitions")
  statusTransitions(@Param("id", ParseUUIDPipe) id: string) {
    return this.casesService.availableStatusTransitions(id);
  }

  @Post()
  create(@Body() dto: CreateCaseDto) {
    return this.casesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }

  @Post(":id/assignee")
  assign(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AssignCaseDto) {
    return this.casesService.assign(id, dto.membershipId ?? null);
  }

  @Post(":id/status-transition")
  transitionStatus(@Param("id", ParseUUIDPipe) id: string, @Body() dto: TransitionCaseStatusDto) {
    return this.casesService.transitionStatus(id, dto.targetStatus);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.casesService.remove(id);
  }

  @Post(":id/restore")
  restore(@Param("id", ParseUUIDPipe) id: string) {
    return this.casesService.restore(id);
  }
}
