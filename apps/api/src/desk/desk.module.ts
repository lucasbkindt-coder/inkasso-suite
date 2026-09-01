import { Module } from "@nestjs/common";

import { ActivityModule } from "../activity/activity.module";
import { CoreModule } from "../core/core.module";
import { DocumentsModule } from "../documents/documents.module";
import { DeskController } from "./desk.controller";
import { DeskService } from "./desk.service";

@Module({
  imports: [CoreModule, ActivityModule, DocumentsModule],
  controllers: [DeskController],
  providers: [DeskService],
})
export class DeskModule {}
