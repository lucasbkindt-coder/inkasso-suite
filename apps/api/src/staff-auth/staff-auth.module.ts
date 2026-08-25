import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";

import { CoreModule } from "../core/core.module";
import { StaffAuthController, StaffMembersController } from "./staff-auth.controller";
import { StaffAuthGuard } from "./staff-auth.guard";
import { StaffAuthService } from "./staff-auth.service";
import { StaffOriginGuard } from "./staff-origin.guard";
import { StaffPermissionGuard } from "./staff-permission.guard";

@Global()
@Module({
  imports: [CoreModule, ThrottlerModule.forRoot([{ name: "staffAuth", ttl: 60_000, limit: 8, blockDuration: 15 * 60_000 }])],
  controllers: [StaffAuthController, StaffMembersController],
  providers: [StaffAuthService, StaffAuthGuard, StaffOriginGuard, StaffPermissionGuard, { provide: APP_GUARD, useExisting: StaffAuthGuard }],
  exports: [StaffAuthService],
})
export class StaffAuthModule {}
