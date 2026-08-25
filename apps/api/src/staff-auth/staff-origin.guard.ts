import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

export function isAllowedStaffOrigin(origin: string | undefined) {
  if (!origin) return true;
  return new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.RISEPAY_LAN_ORIGIN ? [process.env.RISEPAY_LAN_ORIGIN] : []),
  ]).has(origin);
}

@Injectable()
export class StaffOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | undefined> }>();
    const origin = request.headers?.origin;
    if (isAllowedStaffOrigin(origin)) return true;
    throw new ForbiddenException("Diese Anfrage stammt nicht von einer zulässigen Herkunft.");
  }
}
