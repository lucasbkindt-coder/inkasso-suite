import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { PortalPreviewController } from "./portal-preview.controller";
import { PortalPreviewService } from "./portal-preview.service";
@Module({ imports: [CoreModule], controllers: [PortalPreviewController], providers: [PortalPreviewService], exports: [PortalPreviewService] })
export class PortalPreviewModule {}
