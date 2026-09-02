import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ActivityEventType,
  CommunicationAttachmentType,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationSource,
  ContactType,
  MailDeliveryStatus,
  MailMessageDirection,
  MailReviewReason,
  PartyRoleType,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { ActivityService } from "../activity/activity.service";
import { allocateDeskTicketNumber } from "../desk/desk-ticket-number.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { MailAccountsService } from "./mail-accounts.service";
import { MailAttachmentService } from "./mail-attachment.service";
import { MailParserService, type ParsedInboundMail } from "./mail-parser.service";

@Injectable()
export class MailIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly accounts: MailAccountsService,
    private readonly parser: MailParserService,
    private readonly attachments: MailAttachmentService,
    private readonly activity: ActivityService,
  ) {}

  async ingestRaw(accountId: string, raw: Buffer) {
    const tenantId = await this.tenant.getTenantId();
    const account = await this.accounts.find(accountId);
    if (!account.inboundEnabled)
      throw new NotFoundException("Der Posteingang dieses Mailkontos ist nicht aktiviert.");
    let mail: ParsedInboundMail;
    try {
      mail = await this.parser.parse(raw);
    } catch {
      const review = await this.prisma.mailReviewItem.create({
        data: {
          tenantId,
          mailAccountId: account.id,
          reason: MailReviewReason.MALFORMED_MAIL,
          summary: "Die eingehende E-Mail konnte nicht sicher verarbeitet werden.",
        },
      });
      return { duplicate: false, imported: false, review };
    }
    const idempotencyKey = createHash("sha256")
      .update(mail.messageId ? `message-id:${mail.messageId}` : raw)
      .digest("hex");
    const existing = await this.prisma.mailMessage.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      include: { communicationEvent: { select: { deskTicketId: true } } },
    });
    if (existing)
      return {
        duplicate: true,
        imported: false,
        mailMessageId: existing.id,
        ticketId: existing.communicationEvent.deskTicketId,
      };
    const match = await this.match(tenantId, mail);
    const rawPrepared = await this.attachments.prepare([
      {
        filename: `${idempotencyKey}.eml`,
        mimeType: "message/rfc822",
        size: raw.length,
        content: raw,
        type: CommunicationAttachmentType.ORIGINAL_MESSAGE,
      },
    ]);
    let filePrepared: Awaited<ReturnType<MailAttachmentService["prepare"]>> = {
      data: [],
      saved: [],
    };
    let blockedAttachment = false;
    try {
      filePrepared = await this.attachments.prepare(
        mail.attachments.map((item) => ({ ...item, type: CommunicationAttachmentType.ATTACHMENT })),
      );
    } catch {
      blockedAttachment = mail.attachments.length > 0;
    }
    const saved = [...rawPrepared.saved, ...filePrepared.saved];
    try {
      return await this.prisma.$transaction(async (tx) => {
        let ticket = match.ticket;
        if (!ticket) {
          const number = await allocateDeskTicketNumber(tx, tenantId, new Date().getFullYear());
          ticket = await tx.deskTicket.create({
            data: {
              tenantId,
              ...number,
              subject: mail.subject.slice(0, 300),
              source: "EMAIL",
              mailAccountId: account.id,
              partyId: match.partyId,
              caseId: match.caseId,
              unreadAt: new Date(),
            },
          });
          await this.activity.recordSystemEvent(tx, {
            tenantId,
            deskTicketId: ticket.id,
            partyId: ticket.partyId ?? undefined,
            caseId: ticket.caseId ?? undefined,
            eventType: ActivityEventType.DESK_TICKET_CREATED,
            metadata: { source: "EMAIL", number: ticket.number },
          });
        } else
          ticket = await tx.deskTicket.update({
            where: { id: ticket.id },
            data: { unreadAt: new Date(), readAt: null, version: { increment: 1 } },
          });
        const communication = await tx.communicationEvent.create({
          data: {
            tenantId,
            partyId: ticket.partyId,
            caseId: ticket.caseId,
            deskTicketId: ticket.id,
            direction: CommunicationDirection.INBOUND,
            channel: CommunicationChannel.EMAIL,
            source: CommunicationSource.EXTERNAL,
            occurredAt: mail.receivedAt,
            subject: mail.subject,
            summary: mail.bodyPlain,
            externalReference: mail.messageId,
            attachments: {
              create: [...rawPrepared.data, ...filePrepared.data].map((item) => ({
                ...item,
                tenantId,
              })),
            },
          },
        });
        const message = await tx.mailMessage.create({
          data: {
            tenantId,
            communicationEventId: communication.id,
            mailAccountId: account.id,
            direction: MailMessageDirection.INBOUND,
            messageId: mail.messageId,
            idempotencyKey,
            inReplyTo: mail.inReplyTo,
            references: mail.references,
            subject: mail.subject,
            fromAddress: mail.fromAddress,
            toAddresses: mail.toAddresses,
            ccAddresses: mail.ccAddresses,
            bccAddresses: [],
            sanitizedHtml: mail.sanitizedHtml,
            sentAt: mail.sentAt,
            receivedAt: mail.receivedAt,
            deliveryStatus: MailDeliveryStatus.DELIVERED,
            rawMessageStored: true,
            autoSubmitted: mail.autoSubmitted,
            precedence: mail.precedence,
            autoResponseSuppress: mail.autoResponseSuppress,
          },
        });
        const reviews = [
          ...match.reviews,
          ...(blockedAttachment
            ? [
                {
                  reason: MailReviewReason.BLOCKED_ATTACHMENT,
                  summary:
                    "Mindestens ein E-Mail-Anhang wurde durch die Sicherheitsrichtlinie blockiert.",
                },
              ]
            : []),
          ...(ticket.partyId &&
          (
            await tx.party.findUnique({
              where: { id: ticket.partyId },
              select: { processingRestrictedAt: true },
            })
          )?.processingRestrictedAt
            ? [
                {
                  reason: MailReviewReason.PROCESSING_RESTRICTION,
                  summary: "Die zugeordnete Partei besitzt eine aktive Verarbeitungseinschränkung.",
                },
              ]
            : []),
        ];
        if (reviews.length)
          await tx.mailReviewItem.createMany({
            data: reviews.map((review) => ({
              tenantId,
              mailAccountId: account.id,
              mailMessageId: message.id,
              deskTicketId: ticket.id,
              reason: review.reason,
              summary: review.summary,
              suggestedPartyId: match.partyId,
              suggestedCaseId: match.caseId,
            })),
          });
        await this.activity.recordSystemEvent(tx, {
          tenantId,
          deskTicketId: ticket.id,
          partyId: ticket.partyId ?? undefined,
          caseId: ticket.caseId ?? undefined,
          eventType: ActivityEventType.DESK_MAIL_INBOUND_IMPORTED,
          metadata: {
            mailMessageId: message.id,
            mailAccountId: account.id,
            attachmentCount: filePrepared.data.length,
            reviewRequired: reviews.length > 0,
          },
        });
        for (const attachment of [...rawPrepared.data, ...filePrepared.data])
          await this.activity.recordSystemEvent(tx, {
            tenantId,
            deskTicketId: ticket.id,
            eventType: ActivityEventType.DESK_MAIL_ATTACHMENT_IMPORTED,
            metadata: {
              attachmentType: attachment.attachmentType,
              mimeType: attachment.mimeType,
              size: attachment.size,
            },
          });
        return {
          duplicate: false,
          imported: true,
          ticketId: ticket.id,
          mailMessageId: message.id,
          reviewRequired: reviews.length > 0,
        };
      });
    } catch (error) {
      await this.attachments.remove(saved);
      throw error;
    }
  }

  private async match(tenantId: string, mail: ParsedInboundMail) {
    const reviews: { reason: MailReviewReason; summary: string }[] = [];
    const explicit =
      mail.explicitTicketId && /^[0-9a-f-]{36}$/i.test(mail.explicitTicketId)
        ? await this.prisma.deskTicket.findFirst({ where: { id: mail.explicitTicketId, tenantId } })
        : null;
    const chainIds = [mail.inReplyTo, ...mail.references].filter((value): value is string =>
      Boolean(value),
    );
    const chain = chainIds.length
      ? await this.prisma.mailMessage.findMany({
          where: {
            tenantId,
            messageId: { in: chainIds },
            communicationEvent: { deskTicketId: { not: null } },
          },
          select: { communicationEvent: { select: { deskTicket: true } } },
        })
      : [];
    const threadTickets = Array.from(
      new Map(
        chain.flatMap((item) =>
          item.communicationEvent.deskTicket
            ? [[item.communicationEvent.deskTicket.id, item.communicationEvent.deskTicket]]
            : [],
        ),
      ).values(),
    );
    let ticket = explicit ?? (threadTickets.length === 1 ? threadTickets[0] : null);
    if (!explicit && threadTickets.length > 1)
      reviews.push({
        reason: MailReviewReason.THREAD_AMBIGUOUS,
        summary: "Die Header verweisen auf mehrere mögliche Tickets.",
      });
    const [contacts, clientContacts] = await Promise.all([
      this.prisma.contact.findMany({
        where: {
          type: ContactType.EMAIL,
          deletedAt: null,
          value: { equals: mail.fromAddress, mode: "insensitive" },
          party: {
            tenantId,
            deletedAt: null,
            roles: {
              some: { role: { in: [PartyRoleType.CLIENT, PartyRoleType.DEBTOR] }, deletedAt: null },
            },
          },
        },
        select: { partyId: true },
      }),
      this.prisma.clientContact.findMany({
        where: {
          tenantId,
          isActive: true,
          email: { equals: mail.fromAddress, mode: "insensitive" },
          party: { deletedAt: null },
        },
        select: { partyId: true },
      }),
    ]);
    const partyIds = Array.from(
      new Set([...contacts, ...clientContacts].map((item) => item.partyId)),
    );
    let partyId = ticket?.partyId ?? (partyIds.length === 1 ? partyIds[0] : null);
    if (!ticket && partyIds.length > 1)
      reviews.push({
        reason: MailReviewReason.PARTY_AMBIGUOUS,
        summary: "Die Absenderadresse ist mehreren Parteien zugeordnet.",
      });
    const numbers = Array.from(new Set(mail.subject.match(/\b\d{7}\/\d{4}\b/g) ?? []));
    const cases = numbers.length
      ? await this.prisma.case.findMany({
          where: { tenantId, caseNumber: { in: numbers }, deletedAt: null },
        })
      : [];
    let caseId = ticket?.caseId ?? (cases.length === 1 ? cases[0].id : null);
    if (!ticket && cases.length > 1)
      reviews.push({
        reason: MailReviewReason.CASE_AMBIGUOUS,
        summary: "Im Betreff wurden mehrere mögliche Aktenzeichen erkannt.",
      });
    if (caseId && partyId) {
      const record =
        cases.find((item) => item.id === caseId) ??
        (await this.prisma.case.findFirst({ where: { id: caseId, tenantId } }));
      if (record && ![record.clientPartyId, record.debtorPartyId].includes(partyId)) {
        reviews.push({
          reason: MailReviewReason.UNMATCHED_CONTEXT,
          summary: "Absender und erkannte Inkassoakte passen nicht eindeutig zusammen.",
        });
        partyId = null;
      }
    }
    if (!ticket && !partyId && !caseId && !reviews.length)
      reviews.push({
        reason: MailReviewReason.UNMATCHED_CONTEXT,
        summary: "Die E-Mail konnte keiner Partei oder Inkassoakte sicher zugeordnet werden.",
      });
    return { ticket, partyId, caseId, reviews };
  }
}
