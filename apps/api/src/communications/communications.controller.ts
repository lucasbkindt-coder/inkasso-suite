import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { CommunicationAttachmentType } from "@prisma/client";

import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { CommunicationsService } from "./communications.service";
import { CreateCommunicationDto } from "./dto/create-communication.dto";
import { QueryCommunicationsDto } from "./dto/query-communications.dto";
import { UpdateCommunicationDto } from "./dto/update-communication.dto";

type UploadFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };
type UploadResponse = { setHeader(name: string, value: string): void; send(buffer: Buffer): void };

@Controller()
@UseGuards(StaffPermissionGuard)
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get("parties/:partyId/communications")
  @RequireStaffPermissions("debtor:read")
  listForParty(@Param("partyId", ParseUUIDPipe) partyId: string, @Query() query: QueryCommunicationsDto) {
    return this.communications.listForParty(partyId, query);
  }

  @Post("parties/:partyId/communications")
  @RequireStaffPermissions("debtor:update")
  @UseInterceptors(FileFieldsInterceptor([{ name: "originalMessage", maxCount: 1 }, { name: "attachments", maxCount: 9 }], { limits: { fileSize: 10 * 1024 * 1024, files: 10 } }))
  create(
    @Param("partyId", ParseUUIDPipe) partyId: string,
    @Body() dto: CreateCommunicationDto,
    @UploadedFiles() files: { originalMessage?: UploadFile[]; attachments?: UploadFile[] } = {},
  ) {
    const attachments = [
      ...(files.originalMessage ?? []).map((file) => ({ file, attachmentType: CommunicationAttachmentType.ORIGINAL_MESSAGE })),
      ...(files.attachments ?? []).map((file) => ({
        file,
        attachmentType: dto.channel === "LETTER" ? CommunicationAttachmentType.LETTER : CommunicationAttachmentType.ATTACHMENT,
      })),
    ];
    return this.communications.create(partyId, dto, attachments);
  }

  @Get("cases/:caseId/communications")
  @RequireStaffPermissions("case:read")
  listForCase(@Param("caseId", ParseUUIDPipe) caseId: string, @Query() query: QueryCommunicationsDto) {
    return this.communications.listForCase(caseId, query);
  }

  @Patch("communications/:id")
  @RequireStaffPermissions("debtor:update")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCommunicationDto) {
    return this.communications.update(id, dto);
  }

  @Get("communications/:id/attachments/:attachmentId/download")
  @RequireStaffPermissions("debtor:read")
  @Header("Content-Disposition", "attachment")
  async download(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Res() response: UploadResponse,
  ) {
    const { attachment, buffer } = await this.communications.download(id, attachmentId);
    response.setHeader("Content-Type", attachment.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${attachment.originalFileName.replace(/"/g, "")}"`);
    response.send(buffer);
  }
}
