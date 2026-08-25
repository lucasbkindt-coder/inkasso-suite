import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";

import { readCookie } from "../portal-auth/portal-auth.controller";
import { STAFF_SESSION_COOKIE, StaffAuthService } from "./staff-auth.service";
import { isAllowedStaffOrigin } from "./staff-origin.guard";

const isPublicPath = (path: string) => path === "/health" || path === "/auth/login" || path.startsWith("/portal/");

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly auth: StaffAuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      originalUrl?: string;
      url?: string;
      method?: string;
      headers: { cookie?: string; origin?: string };
      staffAuth?: Awaited<ReturnType<StaffAuthService["requireSession"]>>;
    }>();
    const path = (request.originalUrl ?? request.url ?? "").split("?")[0];
    if (isPublicPath(path)) return true;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method ?? "GET") && !isAllowedStaffOrigin(request.headers.origin)) {
      throw new ForbiddenException("Diese Anfrage stammt nicht von einer zulässigen Herkunft.");
    }
    request.staffAuth = await this.auth.requireSession(readCookie(request.headers.cookie, STAFF_SESSION_COOKIE));
    if (request.staffAuth.passwordMustChange && !["/auth/session", "/auth/change-password", "/auth/logout"].includes(path)) {
      throw new ForbiddenException("Das temporäre Passwort muss vor der weiteren Nutzung geändert werden.");
    }
    return true;
  }
}
