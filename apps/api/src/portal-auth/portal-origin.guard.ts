import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

function configuredOrigins() {
  const origins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
  for (const value of [process.env.RISEPAY_LAN_ORIGIN, process.env.PORTAL_PUBLIC_BASE_URL]) {
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Invalid optional configuration must never silently broaden the allowlist.
    }
  }
  return origins;
}

@Injectable()
export class PortalOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ headers?: Record<string, string | undefined> }>();
    const origin = request.headers?.origin;
    if (origin && configuredOrigins().has(origin)) return true;
    throw new ForbiddenException("Diese Portal-Anfrage stammt nicht von einer zulässigen Herkunft.");
  }
}
