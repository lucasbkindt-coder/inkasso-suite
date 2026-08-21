import { Module } from "@nestjs/common";

import { CasesModule } from "../cases/cases.module";
import { CoreModule } from "../core/core.module";
import { PortalPreviewModule } from "../portal-preview/portal-preview.module";
import { PortalAuthModule } from "../portal-auth/portal-auth.module";
import { ClientSubmissionsController } from "./client-submissions.controller";
import { ClientSubmissionsService } from "./client-submissions.service";

@Module({
  imports: [CoreModule, CasesModule, PortalPreviewModule, PortalAuthModule],
  controllers: [ClientSubmissionsController],
  providers: [ClientSubmissionsService],
})
export class ClientSubmissionsModule {}
