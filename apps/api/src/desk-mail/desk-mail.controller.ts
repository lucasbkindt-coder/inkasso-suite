import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import {
  CannedResponseDto,
  CreateMailAccountDto,
  CreateMailDraftDto,
  MailCredentialDto,
  MailListDto,
  ResolveMailReviewDto,
  SignatureDto,
  UpdateMailAccountDto,
  UpdateMailDraftDto,
} from "./dto";
import { MailAccountsService } from "./mail-accounts.service";
import { MailIngestionService } from "./mail-ingestion.service";
import { MailWorkflowService } from "./mail-workflow.service";

type Upload = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Controller("desk/mail")
@UseGuards(StaffPermissionGuard)
export class DeskMailController {
  constructor(
    private readonly accounts: MailAccountsService,
    private readonly ingestion: MailIngestionService,
    private readonly workflow: MailWorkflowService,
  ) {}
  @Get("accounts") @RequireStaffPermissions("desk:read") accountsList() {
    return this.accounts.list();
  }
  @Post("accounts") @RequireStaffPermissions("desk:manage") createAccount(
    @Body() dto: CreateMailAccountDto,
  ) {
    return this.accounts.create(dto);
  }
  @Patch("accounts/:id") @RequireStaffPermissions("desk:manage") updateAccount(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMailAccountDto,
  ) {
    return this.accounts.update(id, dto);
  }
  @Post("accounts/:id/credentials") @RequireStaffPermissions("desk:manage") credentials(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MailCredentialDto,
  ) {
    return this.accounts.credentials(id, dto);
  }
  @Post("accounts/:id/test") @RequireStaffPermissions("desk:manage") test(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.accounts.test(id);
  }
  @Post("accounts/:id/inbound")
  @RequireStaffPermissions("desk:manage")
  @UseInterceptors(FileInterceptor("eml", { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  inbound(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Upload) {
    return this.ingestion.ingestRaw(id, file?.buffer ?? Buffer.alloc(0));
  }
  @Get("inbox") @RequireStaffPermissions("desk:read") inbox(@Query() query: MailListDto) {
    return this.workflow.inbox(query);
  }
  @Get("reviews") @RequireStaffPermissions("desk:read") reviews(@Query() query: MailListDto) {
    return this.workflow.reviews(query);
  }
  @Post("reviews/:id/resolve") @RequireStaffPermissions("desk:manage") resolve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResolveMailReviewDto,
  ) {
    return this.workflow.resolveReview(id, dto);
  }
  @Get("tickets/:ticketId/drafts") @RequireStaffPermissions("desk:read") drafts(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
  ) {
    return this.workflow.listDrafts(ticketId);
  }
  @Post("drafts") @RequireStaffPermissions("desk:manage") createDraft(
    @Body() dto: CreateMailDraftDto,
  ) {
    return this.workflow.createDraft(dto);
  }
  @Patch("drafts/:id") @RequireStaffPermissions("desk:manage") updateDraft(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMailDraftDto,
  ) {
    return this.workflow.updateDraft(id, dto);
  }
  @Post("drafts/:id/attachments")
  @RequireStaffPermissions("desk:manage")
  @UseInterceptors(
    FilesInterceptor("attachments", 10, { limits: { fileSize: 10 * 1024 * 1024, files: 10 } }),
  )
  draftAttachments(@Param("id", ParseUUIDPipe) id: string, @UploadedFiles() files: Upload[] = []) {
    return this.workflow.addDraftAttachments(id, files);
  }
  @Post("drafts/:id/queue") @RequireStaffPermissions("desk:manage") queue(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.workflow.queueDraft(id);
  }
  @Post("outbound-jobs/:id/process") @RequireStaffPermissions("desk:manage") process(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.workflow.processJob(id);
  }
  @Post("tickets/:ticketId/read") @RequireStaffPermissions("desk:manage") read(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
  ) {
    return this.workflow.markRead(ticketId);
  }
  @Get("canned-responses") @RequireStaffPermissions("desk:read") canned() {
    return this.workflow.cannedResponses();
  }
  @Post("canned-responses") @RequireStaffPermissions("desk:manage") createCanned(
    @Body() dto: CannedResponseDto,
  ) {
    return this.workflow.createCanned(dto);
  }
  @Post("signature") @RequireStaffPermissions("desk:manage") signature(@Body() dto: SignatureDto) {
    return this.workflow.saveGlobalSignature(dto);
  }
}
