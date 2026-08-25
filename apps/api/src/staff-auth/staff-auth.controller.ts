import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Res, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { TenantContextService } from "../tenant/tenant-context.service";
import { readCookie } from "../portal-auth/portal-auth.controller";
import { ChangeStaffPasswordDto } from "./dto/change-staff-password.dto";
import { CreateStaffMemberDto } from "./dto/create-staff-member.dto";
import { LoginStaffDto } from "./dto/login-staff.dto";
import { UpdateStaffMemberDto } from "./dto/update-staff-member.dto";
import { StaffOriginGuard } from "./staff-origin.guard";
import { STAFF_SESSION_COOKIE, StaffAuthService } from "./staff-auth.service";

type CookieResponse = { cookie(name: string, value: string, options: Record<string, unknown>): void; clearCookie(name: string, options: Record<string, unknown>): void };

@Controller("auth")
export class StaffAuthController {
  constructor(private readonly auth: StaffAuthService, private readonly tenant: TenantContextService) {}

  @Post("login")
  @UseGuards(StaffOriginGuard, ThrottlerGuard)
  @Throttle({ staffAuth: { limit: 8, ttl: 60_000, blockDuration: 15 * 60_000 } })
  async login(@Body() body: LoginStaffDto, @Res({ passthrough: true }) response: CookieResponse) {
    const result = await this.auth.login(body);
    if (result.requiresTenantSelection) return result;
    response.cookie(STAFF_SESSION_COOKIE, result.token, this.auth.sessionCookieOptions(result.expiresAt));
    return { authenticated: true, expiresAt: result.expiresAt, ...result.session };
  }

  @Post("logout")
  @UseGuards(StaffOriginGuard)
  @HttpCode(204)
  async logout(@Headers("cookie") cookie: string | undefined, @Res({ passthrough: true }) response: CookieResponse) {
    await this.auth.logout(readCookie(cookie, STAFF_SESSION_COOKIE));
    response.clearCookie(STAFF_SESSION_COOKIE, this.auth.sessionCookieOptions());
  }

  @Get("session")
  session() { return this.auth.session(this.tenant.getStaffContext()); }

  @Post("change-password")
  @UseGuards(StaffOriginGuard)
  @HttpCode(204)
  async changePassword(@Headers("cookie") cookie: string | undefined, @Body() body: ChangeStaffPasswordDto) {
    await this.auth.changePassword(this.tenant.getStaffContext(), readCookie(cookie, STAFF_SESSION_COOKIE), body);
  }
}

@Controller()
export class StaffMembersController {
  constructor(private readonly auth: StaffAuthService, private readonly tenant: TenantContextService) {}

  @Get("staff/members")
  activeMembers() { return this.auth.activeMembers(this.tenant.getStaffContext()); }

  @Get("users")
  list() { return this.auth.listMembers(this.tenant.getStaffContext()); }

  @Get("staff/roles")
  roles() { return this.auth.listRoles(this.tenant.getStaffContext()); }

  @Post("users")
  create(@Body() body: CreateStaffMemberDto) { return this.auth.createMember(this.tenant.getStaffContext(), body); }

  @Patch("users/:membershipId")
  update(@Param("membershipId", ParseUUIDPipe) membershipId: string, @Body() body: UpdateStaffMemberDto) { return this.auth.updateMember(this.tenant.getStaffContext(), membershipId, body); }
}
