import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { CoreModule } from "../core/core.module";
import { PortalPreviewModule } from "../portal-preview/portal-preview.module";
import { PortalAccessService } from "./portal-access.service";
import { PortalAuthController } from "./portal-auth.controller";
import { PortalAuthService } from "./portal-auth.service";
import { PortalOriginGuard } from "./portal-origin.guard";

@Module({
  imports: [
    CoreModule,
    PortalPreviewModule,
    ThrottlerModule.forRoot([
      { name: "portalAuth", ttl: 60_000, limit: 8, blockDuration: 15 * 60_000 },
    ]),
  ],
  controllers: [PortalAuthController],
  providers: [PortalAuthService, PortalAccessService, PortalOriginGuard],
  exports: [PortalAuthService, PortalAccessService],
})
export class PortalAuthModule {}
