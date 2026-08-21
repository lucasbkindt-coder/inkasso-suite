import { Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { DocumentsModule } from "../documents/documents.module";
import { PortalAuthModule } from "../portal-auth/portal-auth.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";

@Module({
  imports: [CoreModule, DocumentsModule, PortalAuthModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
