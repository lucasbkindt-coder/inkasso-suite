import { applyDecorators, SetMetadata } from "@nestjs/common";

export const STAFF_PERMISSION_METADATA = "staffPermissions";
export const STAFF_PERMISSION_MODE_METADATA = "staffPermissionMode";

export const RequireStaffPermissions = (...permissions: string[]) => SetMetadata(STAFF_PERMISSION_METADATA, permissions);
export const RequireAnyStaffPermission = (...permissions: string[]) => applyDecorators(
  SetMetadata(STAFF_PERMISSION_METADATA, permissions),
  SetMetadata(STAFF_PERMISSION_MODE_METADATA, "any"),
);
