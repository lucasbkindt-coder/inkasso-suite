import { Body, Controller, Get, Headers, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { ActivatePortalAccountDto } from "./dto/activate-portal-account.dto";
import { LoginPortalAccountDto } from "./dto/login-portal-account.dto";
import { PORTAL_SESSION_COOKIE, PortalAuthService } from "./portal-auth.service";
import { PortalOriginGuard } from "./portal-origin.guard";

type CookieResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
};

@Controller("portal/auth")
export class PortalAuthController {
  constructor(private readonly auth: PortalAuthService) {}

  @Post("activate")
  @UseGuards(PortalOriginGuard, ThrottlerGuard)
  @Throttle({ portalAuth: { limit: 6, ttl: 60_000, blockDuration: 15 * 60_000 } })
  activate(@Body() body: ActivatePortalAccountDto) {
    return this.auth.activate(body);
  }

  @Post("login")
  @UseGuards(PortalOriginGuard, ThrottlerGuard)
  @Throttle({ portalAuth: { limit: 8, ttl: 60_000, blockDuration: 15 * 60_000 } })
  async login(
    @Body() body: LoginPortalAccountDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const result = await this.auth.login(body);
    response.cookie(PORTAL_SESSION_COOKIE, result.token, this.auth.sessionCookieOptions(result.expiresAt));
    return { portalType: result.portalType, expiresAt: result.expiresAt };
  }

  @Post("logout")
  @UseGuards(PortalOriginGuard)
  @HttpCode(204)
  async logout(
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    await this.auth.logout(readCookie(cookieHeader, PORTAL_SESSION_COOKIE));
    response.clearCookie(PORTAL_SESSION_COOKIE, this.auth.sessionCookieOptions());
  }

  @Get("session")
  async session(@Headers("cookie") cookieHeader: string | undefined) {
    const context = await this.auth.requireSession(readCookie(cookieHeader, PORTAL_SESSION_COOKIE));
    return {
      authenticated: true,
      portalType: context.portalType,
      partyId: context.partyId,
    };
  }
}

export function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  const prefix = `${name}=`;
  const item = cookieHeader.split(";").map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : undefined;
}
