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
import { PartiesService } from "./parties.service";
import { CreatePartyDto } from "./dto/create-party.dto";
import { QueryPartiesDto } from "./dto/query-parties.dto";
import { UpdatePartyDto } from "./dto/update-party.dto";

@Controller("parties")
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}
  @Get() findAll(@Query() query: QueryPartiesDto) {
    return this.partiesService.findAll(query);
  }
  @Get(":id") findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.partiesService.findOne(id);
  }
  @Post() create(@Body() dto: CreatePartyDto) {
    return this.partiesService.create(dto);
  }
  @Patch(":id") update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePartyDto) {
    return this.partiesService.update(id, dto);
  }
  @Delete(":id") @HttpCode(204) remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.partiesService.remove(id);
  }
  @Post(":id/restore") restore(@Param("id", ParseUUIDPipe) id: string) {
    return this.partiesService.restore(id);
  }
}
