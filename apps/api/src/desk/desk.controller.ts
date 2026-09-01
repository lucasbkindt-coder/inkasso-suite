import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";

type DownloadResponse = { setHeader(name: string, value: string): void; send(buffer: Buffer): void };

import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { DeskService } from "./desk.service";
import { CreateDeskNoteDto } from "./dto/create-desk-note.dto";
import { CreateDeskTicketDto } from "./dto/create-desk-ticket.dto";
import { QueryDeskTicketsDto, SearchDeskContextDto } from "./dto/query-desk-tickets.dto";
import { UpdateDeskTicketDto } from "./dto/update-desk-ticket.dto";

@Controller("desk")
@UseGuards(StaffPermissionGuard)
export class DeskController {
  constructor(private readonly desk: DeskService) {}

  @Get("dashboard")
  @RequireStaffPermissions("desk:read")
  dashboard() {
    return this.desk.dashboard();
  }

  @Get("options")
  @RequireStaffPermissions("desk:read")
  options() {
    return this.desk.options();
  }

  @Get("config")
  @RequireStaffPermissions("desk:read")
  config() {
    return this.desk.publicConfig();
  }

  @Get("parties")
  @RequireStaffPermissions("desk:read")
  parties(@Query() query: SearchDeskContextDto) {
    return this.desk.searchParties(query.search);
  }

  @Get("cases")
  @RequireStaffPermissions("desk:read")
  cases(@Query() query: SearchDeskContextDto) {
    return this.desk.searchCases(query.search);
  }

  @Get("context/parties/:id")
  @RequireStaffPermissions("desk:read")
  partyContext(@Param("id", ParseUUIDPipe) id: string) {
    return this.desk.partyContext(id);
  }

  @Get("context/cases/:id")
  @RequireStaffPermissions("desk:read")
  caseContext(@Param("id", ParseUUIDPipe) id: string) {
    return this.desk.caseContext(id);
  }

  @Get("tickets")
  @RequireStaffPermissions("desk:read")
  tickets(@Query() query: QueryDeskTicketsDto) {
    return this.desk.findAll(query);
  }

  @Post("tickets")
  @RequireStaffPermissions("desk:manage")
  create(@Body() dto: CreateDeskTicketDto) {
    return this.desk.create(dto);
  }

  @Get("tickets/:id")
  @RequireStaffPermissions("desk:read")
  ticket(@Param("id", ParseUUIDPipe) id: string) {
    return this.desk.findOne(id);
  }

  @Patch("tickets/:id")
  @RequireStaffPermissions("desk:manage")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateDeskTicketDto) {
    return this.desk.update(id, dto);
  }

  @Post("tickets/:id/internal-notes")
  @RequireStaffPermissions("desk:manage")
  addInternalNote(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateDeskNoteDto) {
    return this.desk.addInternalNote(id, dto);
  }

  @Get("tickets/:id/communications/:communicationId/attachments/:attachmentId/download")
  @RequireStaffPermissions("desk:read")
  async downloadAttachment(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("communicationId", ParseUUIDPipe) communicationId: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Res() response: DownloadResponse,
  ) {
    const { attachment, buffer } = await this.desk.downloadAttachment(id, communicationId, attachmentId);
    response.setHeader("Content-Type", attachment.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${attachment.originalFileName.replace(/"/g, "")}"`);
    response.send(buffer);
  }
}
