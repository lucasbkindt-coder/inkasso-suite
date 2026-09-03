import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";

import { RequireAnyStaffPermission, RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import {
  CallbackTaskDto,
  CallActionDto,
  CreateStaffTelephonyAccountDto,
  MockIncomingCallDto,
  PresenceDto,
  QueryCallsDto,
  SetTelephonyCredentialsDto,
  StartCallDto,
  UpdateCallDto,
  UpdateStaffTelephonyAccountDto,
  UpsertProviderConfigDto,
} from "./dto";
import { TelephonyService } from "./telephony.service";

@Controller("desk/telephony")
@UseGuards(StaffPermissionGuard)
export class TelephonyController {
  constructor(private readonly telephony: TelephonyService) {}

  @Get("provider-configs")
  @RequireStaffPermissions("desk:telephony:read")
  providerConfigs() { return this.telephony.listProviderConfigs(); }

  @Post("provider-configs")
  @RequireStaffPermissions("desk:telephony:manage")
  createProviderConfig(@Body() dto: UpsertProviderConfigDto) { return this.telephony.createProviderConfig(dto); }

  @Patch("provider-configs/:id")
  @RequireStaffPermissions("desk:telephony:manage")
  updateProviderConfig(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpsertProviderConfigDto) { return this.telephony.updateProviderConfig(id, dto); }

  @Get("accounts")
  @RequireAnyStaffPermission("desk:telephony:read", "desk:telephony:manage-own")
  accounts(@Query("membershipId") membershipId?: string) { return this.telephony.listAccounts(membershipId); }

  @Get("me")
  @RequireAnyStaffPermission("desk:telephony:use", "desk:telephony:manage-own")
  me() { return this.telephony.myTelephony(); }

  @Post("accounts")
  @RequireAnyStaffPermission("desk:telephony:manage", "desk:telephony:manage-own")
  createAccount(@Body() dto: CreateStaffTelephonyAccountDto) { return this.telephony.createAccount(dto); }

  @Patch("accounts/:id")
  @RequireAnyStaffPermission("desk:telephony:manage", "desk:telephony:manage-own")
  updateAccount(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateStaffTelephonyAccountDto) { return this.telephony.updateAccount(id, dto); }

  @Delete("accounts/:id")
  @RequireAnyStaffPermission("desk:telephony:manage", "desk:telephony:manage-own")
  removeAccount(@Param("id", ParseUUIDPipe) id: string) { return this.telephony.removeAccount(id); }

  @Put("accounts/:id/credentials")
  @RequireAnyStaffPermission("desk:telephony:manage", "desk:telephony:manage-own")
  setCredentials(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetTelephonyCredentialsDto) { return this.telephony.setCredentials(id, dto); }

  @Delete("accounts/:id/credentials")
  @RequireAnyStaffPermission("desk:telephony:manage", "desk:telephony:manage-own")
  deleteCredentials(@Param("id", ParseUUIDPipe) id: string) { return this.telephony.deleteCredentials(id); }

  @Post("accounts/:id/test")
  @RequireAnyStaffPermission("desk:telephony:use", "desk:telephony:manage")
  testRegistration(@Param("id", ParseUUIDPipe) id: string) { return this.telephony.testRegistration(id); }

  @Get("accounts/:id/resolved-config")
  @RequireAnyStaffPermission("desk:telephony:use", "desk:telephony:manage")
  resolvedConfig(@Param("id", ParseUUIDPipe) id: string) { return this.telephony.resolvedAccount(id); }

  @Get("presence")
  @RequireStaffPermissions("desk:telephony:read")
  presenceList() { return this.telephony.listPresence(); }

  @Get("presence/me")
  @RequireAnyStaffPermission("desk:telephony:read", "desk:telephony:use")
  presence() { return this.telephony.presence(); }

  @Put("presence/me")
  @RequireStaffPermissions("desk:telephony:use")
  setPresence(@Body() dto: PresenceDto) { return this.telephony.setPresence(dto); }

  @Get("calls")
  @RequireStaffPermissions("desk:telephony:read")
  calls(@Query() query: QueryCallsDto) { return this.telephony.findCalls(query); }

  @Post("calls/outgoing")
  @RequireStaffPermissions("desk:telephony:use")
  outgoing(@Body() dto: StartCallDto) { return this.telephony.startOutgoing(dto); }

  @Post("mock/incoming")
  @RequireStaffPermissions("desk:telephony:use")
  mockIncoming(@Body() dto: MockIncomingCallDto) { return this.telephony.mockIncoming(dto); }

  @Get("calls/:id")
  @RequireStaffPermissions("desk:telephony:read")
  call(@Param("id", ParseUUIDPipe) id: string) { return this.telephony.findCall(id); }

  @Post("calls/:id/action")
  @RequireStaffPermissions("desk:telephony:use")
  action(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CallActionDto) { return this.telephony.callAction(id, dto); }

  @Patch("calls/:id")
  @RequireStaffPermissions("desk:telephony:use")
  updateCall(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCallDto) { return this.telephony.updateCall(id, dto); }

  @Post("calls/:id/callback-task")
  @RequireStaffPermissions("desk:telephony:use")
  callback(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CallbackTaskDto) { return this.telephony.createCallbackTask(id, dto); }
}
