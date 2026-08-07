import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import { DocumentRenderDto } from "./dto/document.dto";
import { DocumentsService } from "./documents.service";

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}
  @Get("document-templates") templates() {
    return this.documents.templates();
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
