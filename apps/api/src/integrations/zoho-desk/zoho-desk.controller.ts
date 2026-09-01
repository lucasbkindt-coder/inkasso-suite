import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { RequireStaffPermissions } from "../../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../../staff-auth/staff-permission.guard";
import { LinkZohoDeskEntityDto, SearchZohoDeskDto } from "./dto/zoho-desk.dto";
import { ZohoDeskService } from "./zoho-desk.service";

@Controller("integrations/zoho-desk")
@UseGuards(StaffPermissionGuard)
export class ZohoDeskController {
  constructor(private readonly zoho: ZohoDeskService) {}

  @Get("status")
  @RequireStaffPermissions("integration:read")
  status() {
    return this.zoho.status();
  }

  @Post("test")
  @RequireStaffPermissions("integration:manage")
  test() {
    return this.zoho.testConnection();
  }

  @Get("contacts")
  @RequireStaffPermissions("integration:read")
  contacts(@Query() query: SearchZohoDeskDto) {
    return this.zoho.searchContacts(query.query);
  }

  @Get("tickets")
  @RequireStaffPermissions("integration:read")
  tickets(@Query() query: SearchZohoDeskDto) {
    return this.zoho.searchTickets(query.query);
  }

  @Get("parties/:partyId/contact-link")
  @RequireStaffPermissions("integration:read")
  partyContactLink(@Param("partyId", ParseUUIDPipe) partyId: string) {
    return this.zoho.partyContactLink(partyId);
  }

  @Post("parties/:partyId/contact-link")
  @RequireStaffPermissions("integration:manage")
  linkPartyContact(
    @Param("partyId", ParseUUIDPipe) partyId: string,
    @Body() dto: LinkZohoDeskEntityDto,
  ) {
    return this.zoho.linkPartyContact(partyId, dto.externalId);
  }

  @Delete("parties/:partyId/contact-link/:linkId")
  @HttpCode(204)
  @RequireStaffPermissions("integration:manage")
  unlinkPartyContact(
    @Param("partyId", ParseUUIDPipe) partyId: string,
    @Param("linkId", ParseUUIDPipe) linkId: string,
  ) {
    return this.zoho.unlinkPartyContact(partyId, linkId);
  }

  @Get("cases/:caseId/ticket-links")
  @RequireStaffPermissions("integration:read")
  caseTicketLinks(@Param("caseId", ParseUUIDPipe) caseId: string) {
    return this.zoho.caseTicketLinks(caseId);
  }

  @Post("cases/:caseId/ticket-links")
  @RequireStaffPermissions("integration:manage")
  linkCaseTicket(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() dto: LinkZohoDeskEntityDto,
  ) {
    return this.zoho.linkCaseTicket(caseId, dto.externalId);
  }

  @Delete("cases/:caseId/ticket-links/:linkId")
  @HttpCode(204)
  @RequireStaffPermissions("integration:manage")
  unlinkCaseTicket(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("linkId", ParseUUIDPipe) linkId: string,
  ) {
    return this.zoho.unlinkCaseTicket(caseId, linkId);
  }
}
