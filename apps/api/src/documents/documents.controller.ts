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
  UseGuards,
} from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { DocumentRenderDto } from "./dto/document.dto";
import { TenantDocumentSettingsDto } from "./dto/tenant-document-settings.dto";
import { TemplateDto } from "./dto/template.dto";
import { DocumentsService } from "./documents.service";

@Controller()
@UseGuards(StaffPermissionGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}
  @Get("tenant-document-settings") @RequireStaffPermissions("settings:read") settings() {
    return this.documents.settings();
  }
  @Post("tenant-document-settings") @RequireStaffPermissions("settings:update") saveSettings(@Body() dto: TenantDocumentSettingsDto) {
    return this.documents.saveSettings(dto);
  }
  @Get("document-templates") @RequireStaffPermissions("document:read") templates(@Query("includeArchived") includeArchived?: string) {
    return this.documents.templates(includeArchived === "true");
  }
  @Get("document-templates/:id") @RequireStaffPermissions("document:read") template(@Param("id", ParseUUIDPipe) id: string) {
    return this.documents.templateById(id);
  }
  @Post("document-templates") @RequireStaffPermissions("document:create") createTemplate(@Body() dto: TemplateDto) {
    return this.documents.createTemplate(dto);
  }
  @Post("document-templates/:id/archive") @RequireStaffPermissions("document:delete") archiveTemplate(@Param("id", ParseUUIDPipe) id: string) {
    return this.documents.archiveTemplate(id);
  }
  @Post("document-templates/:id/version") @RequireStaffPermissions("document:create") versionTemplate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TemplateDto,
  ) {
    return this.documents.newVersion(id, dto);
  }
  @Patch("document-templates/:id") @RequireStaffPermissions("document:create") updateTemplate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TemplateDto,
  ) {
    return this.documents.newVersion(id, dto);
  }
  @Get("cases/:caseId/documents") @RequireStaffPermissions("document:read") list(@Param("caseId", ParseUUIDPipe) id: string) {
    return this.documents.list(id);
  }
  @Get("cases/:caseId/documents/:documentId") @RequireStaffPermissions("document:read") get(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.get(caseId, documentId);
  }
  @Post("cases/:caseId/documents/preview") @RequireStaffPermissions("document:read") preview(
    @Param("caseId", ParseUUIDPipe) id: string,
    @Body() dto: DocumentRenderDto,
  ) {
    return this.documents.preview(id, dto);
  }
  @Post("cases/:caseId/documents/generate") @RequireStaffPermissions("document:create") generate(
    @Param("caseId", ParseUUIDPipe) id: string,
    @Body() dto: DocumentRenderDto,
  ) {
    return this.documents.generate(id, dto);
  }
  @Post("cases/:caseId/documents/:documentId/void") @RequireStaffPermissions("document:delete") void(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.void(caseId, documentId);
  }
  @Post("documents/:documentId/deliveries/email/retry") @RequireStaffPermissions("document:create") retryEmail(@Param("documentId", ParseUUIDPipe) documentId: string) { return this.documents.retryEmail(documentId); }
  @Get("cases/:caseId/documents/:documentId/download")
  @RequireStaffPermissions("document:read")
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
