import { Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { DocumentsModule } from "../documents/documents.module";
import { CommunicationsController } from "./communications.controller";
import { CommunicationsService } from "./communications.service";

@Module({
  imports: [CoreModule, DocumentsModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
})
export class CommunicationsModule {}
