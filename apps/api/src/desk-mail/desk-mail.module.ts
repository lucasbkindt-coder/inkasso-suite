import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { CoreModule } from "../core/core.module";
import { DocumentsModule } from "../documents/documents.module";
import { DeskMailController } from "./desk-mail.controller";
import { MailAccountsService } from "./mail-accounts.service";
import { MailAttachmentService } from "./mail-attachment.service";
import { MailIngestionService } from "./mail-ingestion.service";
import { MailParserService } from "./mail-parser.service";
import { DeskMailTransportService } from "./mail-transport.service";
import { MailWorkflowService } from "./mail-workflow.service";
import { SecretEncryptionService } from "./secret-encryption.service";

@Module({
  imports: [CoreModule, ActivityModule, DocumentsModule],
  controllers: [DeskMailController],
  providers: [
    SecretEncryptionService,
    MailParserService,
    MailAttachmentService,
    DeskMailTransportService,
    MailAccountsService,
    MailIngestionService,
    MailWorkflowService,
  ],
})
export class DeskMailModule {}
