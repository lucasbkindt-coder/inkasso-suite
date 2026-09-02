import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActivityEventType,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationSource,
  MailDeliveryStatus,
  MailDraftStatus,
  MailMessageDirection,
  MailReviewStatus,
  OutboundMailJobStatus,
  Prisma,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { ActivityService } from "../activity/activity.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import {
  CannedResponseDto,
  CreateMailDraftDto,
  MailListDto,
  ResolveMailReviewDto,
  SignatureDto,
  UpdateMailDraftDto,
} from "./dto";
import { MailAccountsService } from "./mail-accounts.service";
import { MailAttachmentService } from "./mail-attachment.service";
import { MailParserService } from "./mail-parser.service";
import { DeskMailTransportService } from "./mail-transport.service";

@Injectable()
export class MailWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly accounts: MailAccountsService,
    private readonly parser: MailParserService,
    private readonly transport: DeskMailTransportService,
    private readonly activity: ActivityService,
    private readonly attachments: MailAttachmentService,
  ) {}
  async inbox(query: MailListDto) {
    const tenantId = await this.tenant.getTenantId();
    const where: Prisma.MailMessageWhereInput = {
      tenantId,
      direction: "INBOUND",
      ...(query.search?.trim()
        ? {
            OR: [
              { subject: { contains: query.search.trim(), mode: "insensitive" } },
              { fromAddress: { contains: query.search.trim(), mode: "insensitive" } },
              {
                communicationEvent: {
                  deskTicket: {
                    is: { number: { contains: query.search.trim(), mode: "insensitive" } },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mailMessage.findMany({
        where,
        include: {
          communicationEvent: {
            include: {
              deskTicket: {
                include: {
                  party: { select: { id: true, displayName: true } },
                  case: { select: { id: true, caseNumber: true } },
                  assigneeMembership: {
                    select: { user: { select: { displayName: true, email: true } } },
                  },
                },
              },
            },
          },
          mailAccount: { select: { name: true, emailAddress: true } },
        },
        orderBy: { receivedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.mailMessage.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
  async reviews(query: MailListDto) {
    const tenantId = await this.tenant.getTenantId();
    const where = { tenantId, status: query.status ?? MailReviewStatus.PENDING };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mailReviewItem.findMany({
        where,
        include: {
          mailMessage: { select: { subject: true, fromAddress: true, receivedAt: true } },
          deskTicket: { select: { id: true, number: true, subject: true } },
          suggestedParty: { select: { id: true, displayName: true } },
          suggestedCase: { select: { id: true, caseNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.mailReviewItem.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
  async resolveReview(id: string, dto: ResolveMailReviewDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const item = await this.prisma.mailReviewItem.findFirst({
      where: { id, tenantId, status: MailReviewStatus.PENDING },
      include: { deskTicket: true, mailMessage: { include: { communicationEvent: true } } },
    });
    if (!item) throw new NotFoundException("Review-Eintrag wurde nicht gefunden.");
    const ticketId = dto.ticketId ?? item.deskTicketId;
    if (
      ticketId &&
      !(await this.prisma.deskTicket.findFirst({ where: { id: ticketId, tenantId } }))
    )
      throw new BadRequestException("Ticket gehört nicht zum aktiven Mandanten.");
    if (
      dto.partyId &&
      !(await this.prisma.party.findFirst({
        where: { id: dto.partyId, tenantId, deletedAt: null },
      }))
    )
      throw new BadRequestException("Partei gehört nicht zum aktiven Mandanten.");
    if (
      dto.caseId &&
      !(await this.prisma.case.findFirst({ where: { id: dto.caseId, tenantId, deletedAt: null } }))
    )
      throw new BadRequestException("Akte gehört nicht zum aktiven Mandanten.");
    return this.prisma.$transaction(async (tx) => {
      if (!dto.ignored && ticketId) {
        await tx.deskTicket.update({
          where: { id: ticketId },
          data: { partyId: dto.partyId, caseId: dto.caseId, version: { increment: 1 } },
        });
        if (item.mailMessage)
          await tx.communicationEvent.update({
            where: { id: item.mailMessage.communicationEventId },
            data: { deskTicketId: ticketId, partyId: dto.partyId, caseId: dto.caseId },
          });
      }
      const updated = await tx.mailReviewItem.update({
        where: { id },
        data: {
          status: dto.ignored ? MailReviewStatus.IGNORED : MailReviewStatus.RESOLVED,
          resolvedByMembershipId: actor.tenantMembershipId,
          resolvedAt: new Date(),
          resolutionNote: dto.note?.trim() || null,
        },
      });
      await this.activity.recordStaffEvent(tx, actor.tenantMembershipId, {
        tenantId,
        deskTicketId: ticketId ?? undefined,
        partyId: dto.partyId,
        caseId: dto.caseId,
        eventType: ActivityEventType.DESK_MAIL_REVIEW_RESOLVED,
        metadata: { reviewId: id, status: updated.status },
      });
      return updated;
    });
  }

  async createDraft(dto: CreateMailDraftDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const ticket = await this.prisma.deskTicket.findFirst({
      where: { id: dto.ticketId, tenantId },
      include: { party: { select: { processingRestrictedAt: true } } },
    });
    if (!ticket) throw new NotFoundException("Ticket wurde nicht gefunden.");
    const account = await this.accounts.find(dto.mailAccountId);
    const latest = await this.prisma.mailMessage.findFirst({
      where: { tenantId, communicationEvent: { deskTicketId: ticket.id } },
      orderBy: { createdAt: "desc" },
    });
    const signatures = await this.signatures(tenantId, actor.tenantMembershipId);
    const bodyPlain = [
      dto.bodyPlain.trim(),
      signatures.user?.bodyPlain,
      signatures.global?.globalSignaturePlain,
    ]
      .filter(Boolean)
      .join("\n\n");
    const bodyHtml = dto.bodyHtml ? this.parser.sanitize(dto.bodyHtml) : null;
    return this.prisma.$transaction(async (tx) => {
      const communication = await tx.communicationEvent.create({
        data: {
          tenantId,
          partyId: ticket.partyId,
          caseId: ticket.caseId,
          deskTicketId: ticket.id,
          direction: CommunicationDirection.OUTBOUND,
          channel: CommunicationChannel.EMAIL,
          source: CommunicationSource.MANUAL,
          occurredAt: new Date(),
          subject: dto.subject.trim(),
          summary: bodyPlain,
          createdByMembershipId: actor.tenantMembershipId,
        },
      });
      const draft = await tx.mailDraft.create({
        data: {
          tenantId,
          ticketId: ticket.id,
          mailAccountId: account.id,
          communicationEventId: communication.id,
          toAddresses: dto.toAddresses.map(this.email),
          ccAddresses: dto.ccAddresses.map(this.email),
          subject: dto.subject.trim(),
          bodyPlain,
          bodyHtml,
          inReplyTo: latest?.messageId,
          references: Array.from(
            new Set([
              ...(latest?.references ?? []),
              ...(latest?.messageId ? [latest.messageId] : []),
            ]),
          ),
          createdByMembershipId: actor.tenantMembershipId,
          updatedByMembershipId: actor.tenantMembershipId,
        },
      });
      await this.activity.recordStaffEvent(tx, actor.tenantMembershipId, {
        tenantId,
        deskTicketId: ticket.id,
        partyId: ticket.partyId ?? undefined,
        caseId: ticket.caseId ?? undefined,
        eventType: ActivityEventType.DESK_MAIL_DRAFT_CREATED,
        metadata: {
          draftId: draft.id,
          mailAccountId: account.id,
          processingRestricted: Boolean(ticket.party?.processingRestrictedAt),
        },
      });
      return draft;
    });
  }
  async updateDraft(id: string, dto: UpdateMailDraftDto) {
    const draft = await this.findDraft(id);
    if (draft.status !== MailDraftStatus.DRAFT)
      throw new ConflictException("Nur offene Entwürfe können geändert werden.");
    const actor = this.tenant.getStaffContext();
    const result = await this.prisma.mailDraft.updateMany({
      where: { id, tenantId: draft.tenantId, version: dto.version, status: MailDraftStatus.DRAFT },
      data: {
        toAddresses: dto.toAddresses?.map(this.email),
        ccAddresses: dto.ccAddresses?.map(this.email),
        subject: dto.subject?.trim(),
        bodyPlain: dto.bodyPlain?.trim(),
        updatedByMembershipId: actor.tenantMembershipId,
        version: { increment: 1 },
      },
    });
    if (!result.count)
      throw new ConflictException("Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.");
    const updated = await this.prisma.mailDraft.findUniqueOrThrow({ where: { id } });
    await this.prisma.communicationEvent.update({
      where: { id: updated.communicationEventId },
      data: { subject: updated.subject, summary: updated.bodyPlain },
    });
    await this.activity.recordStaffEvent(this.prisma, actor.tenantMembershipId, {
      tenantId: draft.tenantId,
      deskTicketId: draft.ticketId,
      eventType: ActivityEventType.DESK_MAIL_DRAFT_UPDATED,
      metadata: { draftId: id, version: updated.version },
    });
    return updated;
  }
  async listDrafts(ticketId: string) {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.mailDraft.findMany({
      where: { tenantId, ticketId },
      include: { mailAccount: { select: { name: true, emailAddress: true } }, outboundJob: true },
      orderBy: { updatedAt: "desc" },
    });
  }
  async addDraftAttachments(
    id: string,
    files: { originalname: string; mimetype: string; size: number; buffer: Buffer }[],
  ) {
    const draft = await this.findDraft(id);
    if (draft.status !== MailDraftStatus.DRAFT)
      throw new ConflictException("Anhänge können nur offenen Entwürfen hinzugefügt werden.");
    const prepared = await this.attachments.prepare(
      files.map((file) => ({
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        content: file.buffer,
      })),
    );
    try {
      await this.prisma.communicationAttachment.createMany({
        data: prepared.data.map((item) => ({
          ...item,
          tenantId: draft.tenantId,
          communicationId: draft.communicationEventId,
        })),
      });
      return this.prisma.communicationAttachment.findMany({
        where: { communicationId: draft.communicationEventId },
        select: { id: true, originalFileName: true, mimeType: true, size: true },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      await this.attachments.remove(prepared.saved);
      throw error;
    }
  }
  async queueDraft(id: string) {
    const draft = await this.findDraft(id);
    if (draft.status !== MailDraftStatus.DRAFT)
      throw new ConflictException("Der Entwurf wurde bereits verarbeitet.");
    const ticket = await this.prisma.deskTicket.findFirstOrThrow({
      where: { id: draft.ticketId, tenantId: draft.tenantId },
      include: { party: true, mailAccount: true },
    });
    const account = await this.accounts.find(draft.mailAccountId);
    if (!account.outboundEnabled || account.status !== "ACTIVE")
      throw new ConflictException(
        "Der ausgehende Versand ist für dieses Mailkonto nicht freigegeben.",
      );
    if (ticket.party?.processingRestrictedAt)
      throw new ConflictException(
        "Der Versand ist wegen einer Verarbeitungseinschränkung blockiert. Der Entwurf bleibt erhalten.",
      );
    if (
      ticket.partyId &&
      (await this.prisma.mailContactPreference.findFirst({
        where: { tenantId: draft.tenantId, partyId: ticket.partyId, preference: "EMAIL_BLOCKED" },
      }))
    )
      throw new ConflictException("Der E-Mail-Kontakt ist für diese Partei gesperrt.");
    const actor = this.tenant.getStaffContext();
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.mailMessage.create({
        data: {
          tenantId: draft.tenantId,
          communicationEventId: draft.communicationEventId,
          mailAccountId: account.id,
          direction: MailMessageDirection.OUTBOUND,
          idempotencyKey: createHash("sha256").update(`outbound:${draft.id}`).digest("hex"),
          inReplyTo: draft.inReplyTo,
          references: draft.references,
          subject: draft.subject,
          fromAddress: account.emailAddress,
          toAddresses: draft.toAddresses,
          ccAddresses: draft.ccAddresses,
          bccAddresses: [],
          deliveryStatus: MailDeliveryStatus.PENDING,
        },
      });
      const job = await tx.outboundMailJob.create({
        data: {
          tenantId: draft.tenantId,
          draftId: draft.id,
          mailAccountId: account.id,
          mailMessageId: message.id,
        },
      });
      await tx.mailDraft.update({ where: { id }, data: { status: MailDraftStatus.QUEUED } });
      await this.activity.recordStaffEvent(tx, actor.tenantMembershipId, {
        tenantId: draft.tenantId,
        deskTicketId: draft.ticketId,
        eventType: ActivityEventType.DESK_MAIL_QUEUED,
        metadata: { draftId: draft.id, jobId: job.id, mailMessageId: message.id },
      });
      return job;
    });
  }
  async processJob(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const job = await this.prisma.outboundMailJob.findFirst({
      where: { id, tenantId },
      include: { draft: true, mailAccount: true, mailMessage: true },
    });
    if (!job || !job.mailMessage)
      throw new NotFoundException("Mailqueue-Eintrag wurde nicht gefunden.");
    if (job.status !== OutboundMailJobStatus.QUEUED && job.status !== OutboundMailJobStatus.RETRY)
      throw new ConflictException("Dieser Mailqueue-Eintrag kann nicht verarbeitet werden.");
    const claimed = await this.prisma.outboundMailJob.updateMany({
      where: { id, tenantId, status: job.status },
      data: {
        status: OutboundMailJobStatus.PROCESSING,
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count)
      throw new ConflictException("Der Mailqueue-Eintrag wird bereits verarbeitet.");
    try {
      const sent = await this.transport.send(job.mailAccount, job.draft);
      await this.prisma.$transaction(async (tx) => {
        await tx.mailMessage.update({
          where: { id: job.mailMessage!.id },
          data: {
            messageId: sent.messageId,
            providerExternalId: sent.providerExternalId,
            deliveryStatus: MailDeliveryStatus.SENT,
            sentAt: new Date(),
          },
        });
        await tx.outboundMailJob.update({
          where: { id },
          data: {
            status: OutboundMailJobStatus.SENT,
            lockedAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
        await tx.mailDraft.update({
          where: { id: job.draftId },
          data: { status: MailDraftStatus.SENT },
        });
        await this.activity.recordSystemEvent(tx, {
          tenantId,
          deskTicketId: job.draft.ticketId,
          eventType: ActivityEventType.DESK_MAIL_SENT,
          metadata: { jobId: id, mailMessageId: job.mailMessage!.id },
        });
      });
      return { status: OutboundMailJobStatus.SENT };
    } catch (error) {
      const attempts = job.attempts + 1;
      const retry = attempts < job.maxAttempts;
      const nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000);
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Transportfehler";
      await this.prisma.$transaction(async (tx) => {
        await tx.outboundMailJob.update({
          where: { id },
          data: {
            status: retry ? OutboundMailJobStatus.RETRY : OutboundMailJobStatus.FAILED,
            lockedAt: null,
            nextAttemptAt,
            lastErrorCode: "TRANSPORT_FAILED",
            lastErrorMessage: message,
          },
        });
        await tx.mailMessage.update({
          where: { id: job.mailMessage!.id },
          data: { deliveryStatus: MailDeliveryStatus.FAILED },
        });
        await this.activity.recordSystemEvent(tx, {
          tenantId,
          deskTicketId: job.draft.ticketId,
          eventType: ActivityEventType.DESK_MAIL_FAILED,
          metadata: { jobId: id, attempt: attempts, retry },
        });
      });
      return {
        status: retry ? OutboundMailJobStatus.RETRY : OutboundMailJobStatus.FAILED,
        nextAttemptAt: retry ? nextAttemptAt : null,
      };
    }
  }
  async markRead(ticketId: string) {
    const tenantId = await this.tenant.getTenantId();
    const result = await this.prisma.deskTicket.updateMany({
      where: { id: ticketId, tenantId },
      data: { unreadAt: null, readAt: new Date(), version: { increment: 1 } },
    });
    if (!result.count) throw new NotFoundException("Ticket wurde nicht gefunden.");
    await this.activity.recordStaffEvent(
      this.prisma,
      this.tenant.getStaffContext().tenantMembershipId,
      { tenantId, deskTicketId: ticketId, eventType: ActivityEventType.DESK_MAIL_READ },
    );
    return { read: true };
  }
  async cannedResponses() {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.deskCannedResponse.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  }
  async createCanned(dto: CannedResponseDto) {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.deskCannedResponse.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        subject: dto.subject?.trim() || null,
        body: dto.body.trim(),
      },
    });
  }
  async saveGlobalSignature(dto: SignatureDto) {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.deskMailSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        globalSignaturePlain: dto.bodyPlain,
        globalSignatureHtml: dto.bodyHtml ? this.parser.sanitize(dto.bodyHtml) : null,
      },
      update: {
        globalSignaturePlain: dto.bodyPlain,
        globalSignatureHtml: dto.bodyHtml ? this.parser.sanitize(dto.bodyHtml) : null,
      },
    });
  }
  private async signatures(tenantId: string, membershipId: string) {
    const [global, user] = await Promise.all([
      this.prisma.deskMailSettings.findUnique({ where: { tenantId } }),
      this.prisma.deskMailUserSignature.findUnique({ where: { membershipId } }),
    ]);
    return { global, user };
  }
  private async findDraft(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const item = await this.prisma.mailDraft.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException("Mailentwurf wurde nicht gefunden.");
    return item;
  }
  private email(value: string) {
    return value.trim().toLowerCase();
  }
}
