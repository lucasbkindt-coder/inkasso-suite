import { Module } from "@nestjs/common";
import { PortalAuthModule } from "../portal-auth/portal-auth.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { LocalDocumentStorage } from "./local-document-storage";

@Module({ imports: [PortalAuthModule], controllers: [DocumentsController], providers: [DocumentsService, LocalDocumentStorage], exports: [LocalDocumentStorage] })
export class DocumentsModule {}
