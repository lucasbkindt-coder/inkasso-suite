import { Module } from "@nestjs/common";
import { PortalAuthModule } from "../portal-auth/portal-auth.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { LocalDocumentStorage } from "./local-document-storage";
import { MailService } from "./mail.service";

@Module({ imports: [PortalAuthModule], controllers: [DocumentsController], providers: [DocumentsService, LocalDocumentStorage, MailService], exports: [LocalDocumentStorage] })
export class DocumentsModule {}
