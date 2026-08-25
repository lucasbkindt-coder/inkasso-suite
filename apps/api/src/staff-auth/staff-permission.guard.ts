import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { TenantContextService } from "../tenant/tenant-context.service";
import { STAFF_PERMISSION_METADATA, STAFF_PERMISSION_MODE_METADATA } from "./staff-permission.decorator";

@Injectable()
export class StaffPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tenant: TenantContextService) {}

  canActivate(context: ExecutionContext) {
    const permissions = this.reflector.getAllAndOverride<string[]>(STAFF_PERMISSION_METADATA, [context.getHandler(), context.getClass()]) ?? [];
    if (!permissions.length) return true;
    const mode = this.reflector.getAllAndOverride<"all" | "any">(STAFF_PERMISSION_MODE_METADATA, [context.getHandler(), context.getClass()]) ?? "all";
    const granted = this.tenant.getStaffContext().permissions;
    const allowed = mode === "any" ? permissions.some((permission) => granted.includes(permission)) : permissions.every((permission) => granted.includes(permission));
    if (!allowed) throw new ForbiddenException("Berechtigung erforderlich.");
    return true;
  }
}
