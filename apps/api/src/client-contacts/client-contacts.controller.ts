import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";

import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { ClientContactsService } from "./client-contacts.service";
import { CreateClientContactDto } from "./dto/create-client-contact.dto";
import { UpdateClientContactDto } from "./dto/update-client-contact.dto";

@Controller()
@UseGuards(StaffPermissionGuard)
export class ClientContactsController {
  constructor(private readonly contacts: ClientContactsService) {}

  @Get("parties/:clientId/contacts")
  @RequireStaffPermissions("debtor:read")
  list(@Param("clientId", ParseUUIDPipe) clientId: string) { return this.contacts.list(clientId); }

  @Post("parties/:clientId/contacts")
  @RequireStaffPermissions("debtor:update")
  create(@Param("clientId", ParseUUIDPipe) clientId: string, @Body() dto: CreateClientContactDto) { return this.contacts.create(clientId, dto); }

  @Patch("parties/:clientId/contacts/:contactId")
  @RequireStaffPermissions("debtor:update")
  update(@Param("clientId", ParseUUIDPipe) clientId: string, @Param("contactId", ParseUUIDPipe) contactId: string, @Body() dto: UpdateClientContactDto) { return this.contacts.update(clientId, contactId, dto); }

  @Post("parties/:clientId/contacts/:contactId/portal-account")
  @RequireStaffPermissions("debtor:update")
  createPortalAccount(@Param("clientId", ParseUUIDPipe) clientId: string, @Param("contactId", ParseUUIDPipe) contactId: string) { return this.contacts.createPortalAccount(clientId, contactId); }

  @Post("portal-accounts/:id/activation/reissue")
  @RequireStaffPermissions("debtor:update")
  reissue(@Param("id", ParseUUIDPipe) id: string) { return this.contacts.reissueActivation(id); }

  @Post("portal-accounts/:id/suspend")
  @RequireStaffPermissions("debtor:update")
  suspend(@Param("id", ParseUUIDPipe) id: string) { return this.contacts.suspendPortalAccount(id); }

  @Post("portal-accounts/:id/reactivate")
  @RequireStaffPermissions("debtor:update")
  reactivate(@Param("id", ParseUUIDPipe) id: string) { return this.contacts.reactivatePortalAccount(id); }
}
