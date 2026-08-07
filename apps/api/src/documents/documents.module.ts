import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { LocalDocumentStorage } from "./local-document-storage";

@Module({ controllers: [DocumentsController], providers: [DocumentsService, LocalDocumentStorage] })
export class DocumentsModule {}
