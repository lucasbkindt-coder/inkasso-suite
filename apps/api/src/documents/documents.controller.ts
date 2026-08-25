import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { DocumentRenderDto } from "./dto/document.dto";
import { TenantDocumentSettingsDto } from "./dto/tenant-document-settings.dto";
import { TemplateDto } from "./dto/template.dto";
import { DocumentsService } from "./documents.service";

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}
  @Get("tenant-document-settings") settings() {
    return this.documents.settings();
  }
  @Post("tenant-document-settings") saveSettings(@Body() dto: TenantDocumentSettingsDto) {
    return this.documents.saveSettings(dto);
  }
  @Get("document-templates") templates(@Query("includeArchived") includeArchived?: string) {
    return this.documents.templates(includeArchived === "true");
  }
  @Get("document-templates/:id") template(@Param("id", ParseUUIDPipe) id: string) {
    return this.documents.templateById(id);
  }
  @Post("document-templates") createTemplate(@Body() dto: TemplateDto) {
    return this.documents.createTemplate(dto);
  }
  @Post("document-templates/:id/archive") archiveTemplate(@Param("id", ParseUUIDPipe) id: string) {
    return this.documents.archiveTemplate(id);
  }
  @Post("document-templates/:id/version") versionTemplate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TemplateDto,
  ) {
    return this.documents.newVersion(id, dto);
  }
  @Patch("document-templates/:id") updateTemplate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TemplateDto,
  ) {
    return this.documents.newVersion(id, dto);
  }
  @Get("cases/:caseId/documents") list(@Param("caseId", ParseUUIDPipe) id: string) {
    return this.documents.list(id);
  }
  @Get("cases/:caseId/documents/:documentId") get(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.get(caseId, documentId);
  }
  @Post("cases/:caseId/documents/preview") preview(
    @Param("caseId", ParseUUIDPipe) id: string,
    @Body() dto: DocumentRenderDto,
  ) {
    return this.documents.preview(id, dto);
  }
  @Post("cases/:caseId/documents/generate") generate(
    @Param("caseId", ParseUUIDPipe) id: string,
    @Body() dto: DocumentRenderDto,
  ) {
    return this.documents.generate(id, dto);
  }
  @Post("cases/:caseId/documents/:documentId/void") void(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.void(caseId, documentId);
  }
  @Post("documents/:documentId/deliveries/email/retry") retryEmail(@Param("documentId", ParseUUIDPipe) documentId: string) { return this.documents.retryEmail(documentId); }
  @Get("cases/:caseId/documents/:documentId/download")
  @Header("Content-Type", "application/pdf")
  async download(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Res() response: { setHeader(name: string, value: string): void; send(buffer: Buffer): void },
  ) {
    const file = await this.documents.download(caseId, documentId);
    if (!file) throw new NotFoundException();
    response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    response.send(file.buffer);
  }
}
