import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { AddressResearchService } from "./address-research.service";
import { AddAddressResearchResultDto, AddressResearchNoteDto, CreateAddressResearchDto, QueryAddressResearchDto } from "./dto";

@Controller("address-research")
@UseGuards(StaffPermissionGuard)
export class AddressResearchController {
  constructor(private readonly service: AddressResearchService) {}
  @Get() @RequireStaffPermissions("address-research:read") list(@Query() query: QueryAddressResearchDto) { return this.service.list(query); }
  @Get("options") @RequireStaffPermissions("address-research:read") options() { return this.service.options(); }
  @Get(":id") @RequireStaffPermissions("address-research:read") get(@Param("id", ParseUUIDPipe) id: string) { return this.service.get(id); }
  @Post() @RequireStaffPermissions("address-research:manage") create(@Body() dto: CreateAddressResearchDto) { return this.service.create(dto); }
  @Post(":id/run") @RequireStaffPermissions("address-research:manage") run(@Param("id", ParseUUIDPipe) id: string) { return this.service.runProvider(id); }
  @Post(":id/results") @RequireStaffPermissions("address-research:manage") result(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddAddressResearchResultDto) { return this.service.addResult(id, dto); }
  @Post(":id/no-result") @RequireStaffPermissions("address-research:manage") noResult(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddressResearchNoteDto) { return this.service.noResult(id, dto.note); }
  @Post(":id/cancel") @RequireStaffPermissions("address-research:manage") cancel(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddressResearchNoteDto) { return this.service.cancel(id, dto.note); }
  @Post(":id/results/:resultId/apply") @RequireStaffPermissions("address-research:manage") apply(@Param("id", ParseUUIDPipe) id: string, @Param("resultId", ParseUUIDPipe) resultId: string) { return this.service.apply(id, resultId); }
}
