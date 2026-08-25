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
import { UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { PartiesService } from "./parties.service";
import { CreatePartyDto } from "./dto/create-party.dto";
import { QueryPartiesDto } from "./dto/query-parties.dto";
import { UpdatePartyDto } from "./dto/update-party.dto";

@Controller("parties")
@UseGuards(StaffPermissionGuard)
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}
  @Get() @RequireStaffPermissions("debtor:read") findAll(@Query() query: QueryPartiesDto) {
    return this.partiesService.findAll(query);
  }
  @Get(":id") @RequireStaffPermissions("debtor:read") findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.partiesService.findOne(id);
  }
  @Post() @RequireStaffPermissions("debtor:create") create(@Body() dto: CreatePartyDto) {
    return this.partiesService.create(dto);
  }
  @Patch(":id") @RequireStaffPermissions("debtor:update") update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePartyDto) {
    return this.partiesService.update(id, dto);
  }
  @Delete(":id") @HttpCode(204) @RequireStaffPermissions("debtor:update") remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.partiesService.remove(id);
  }
  @Post(":id/restore") @RequireStaffPermissions("debtor:update") restore(@Param("id", ParseUUIDPipe) id: string) {
    return this.partiesService.restore(id);
  }
}
