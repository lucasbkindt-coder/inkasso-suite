import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActivityEventType,
  CommunicationAttachmentType,
  CommunicationChannel,
  PartyRoleType,
  Prisma,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { extname } from "node:path";

import { ActivityService } from "../activity/activity.service";
import { LocalDocumentStorage } from "../documents/local-document-storage";
import { PrismaService } from "../prisma/prisma.service";
import { StaffAuthService } from "../staff-auth/staff-auth.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateCommunicationDto } from "./dto/create-communication.dto";
import { QueryCommunicationsDto } from "./dto/query-communications.dto";
import { UpdateCommunicationDto } from "./dto/update-communication.dto";

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type AttachmentInput = {
  file: UploadFile;
  attachmentType: CommunicationAttachmentType;
};

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const allowedExtensions = new Map<string, string[]>([
  ["eml", ["message/rfc822", "application/octet-stream"]],
  ["pdf", ["application/pdf", "application/octet-stream"]],
  ["png", ["image/png", "application/octet-stream"]],
  ["jpg", ["image/jpeg", "application/octet-stream"]],
  ["jpeg", ["image/jpeg", "application/octet-stream"]],
  ["doc", ["application/msword", "application/octet-stream"]],
  ["docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"]],
  ["xls", ["application/vnd.ms-excel", "application/octet-stream"]],
  ["xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]],
]);

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly staff: StaffAuthService,
    private readonly activity: ActivityService,
    private readonly storage: LocalDocumentStorage,
  ) {}

  async create(partyId: string, dto: CreateCommunicationDto, attachments: AttachmentInput[]) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    this.staff.requirePermission(actor, "debtor:update");
    await this.assertDebtorParty(partyId, tenantId);
    await this.assertCase(dto.caseId, partyId, tenantId);
    if (!dto.summary.trim()) throw new BadRequestException("Ein Gesprächsvermerk oder eine Notiz ist erforderlich.");
    this.assertAttachments(attachments);

    const saved: { storageKey: string }[] = [];
    try {
      const prepared = [] as Array<{
        input: AttachmentInput;
        originalFileName: string;
        extension: string;
        storageKey: string;
        sha256: string;
        metadata: Prisma.InputJsonValue | undefined;
      }>;
      for (const input of attachments) {
        const originalFileName = this.safeFileName(input.file.originalname);
        const extension = this.extension(originalFileName);
        const storageKey = await this.storage.save(input.file.buffer, extension);
        saved.push({ storageKey });
        prepared.push({
          input,
          originalFileName,
          extension,
          storageKey,
          sha256: createHash("sha256").update(input.file.buffer).digest("hex"),
          metadata: extension === "eml" ? this.emlMetadata(input.file.buffer) : undefined,
        });
      }

      return await this.prisma.$transaction(async (tx) => {
        const communication = await tx.communicationEvent.create({
          data: {
            tenantId,
            partyId,
            caseId: dto.caseId,
            direction: dto.direction,
            channel: dto.channel,
            source: dto.source ?? "MANUAL",
            occurredAt: new Date(dto.occurredAt),
            subject: dto.subject?.trim() || null,
            summary: dto.summary.trim(),
            externalReference: dto.externalReference?.trim() || null,
            durationSeconds: dto.durationSeconds,
            createdByMembershipId: actor.tenantMembershipId,
            attachments: {
              create: prepared.map((item) => ({
                tenantId,
                attachmentType: item.input.attachmentType,
                originalFileName: item.originalFileName,
                mimeType: item.input.file.mimetype || this.defaultMimeType(item.extension),
                size: item.input.file.size,
                storageKey: item.storageKey,
                sha256: item.sha256,
                metadata: item.metadata,
              })),
            },
          },
          include: this.include(),
        });
        await this.activity.recordStaffEvent(tx, actor.tenantMembershipId, {
          tenantId,
          partyId,
          caseId: dto.caseId,
          eventType: ActivityEventType.COMMUNICATION_CREATED,
          title: this.activityTitle(dto.direction, dto.channel),
          metadata: { communicationId: communication.id, channel: dto.channel, direction: dto.direction },
          sourceEntityType: "CommunicationEvent",
          sourceEntityId: communication.id,
        });
        for (const attachment of communication.attachments) {
          await this.activity.recordStaffEvent(tx, actor.tenantMembershipId, {
            tenantId,
            partyId,
            caseId: dto.caseId,
            eventType: ActivityEventType.COMMUNICATION_ATTACHMENT_ADDED,
            metadata: { communicationId: communication.id, attachmentId: attachment.id, attachmentType: attachment.attachmentType },
            sourceEntityType: "CommunicationAttachment",
            sourceEntityId: attachment.id,
          });
        }
        return communication;
      });
    } catch (error) {
      await Promise.all(saved.map((item) => this.storage.remove(item.storageKey)));
      throw error;
    }
  }

  async listForParty(partyId: string, query: QueryCommunicationsDto) {
    const tenantId = await this.tenant.getTenantId();
    this.staff.requirePermission(this.tenant.getStaffContext(), "debtor:read");
    await this.assertDebtorParty(partyId, tenantId);
    return this.list({ tenantId, partyId, channel: query.channel }, query);
  }

  async listForCase(caseId: string, query: QueryCommunicationsDto) {
    const tenantId = await this.tenant.getTenantId();
    this.staff.requirePermission(this.tenant.getStaffContext(), "case:read");
    await this.assertExistingCase(caseId, tenantId);
    return this.list({ tenantId, caseId, channel: query.channel }, query);
  }

  async update(id: string, dto: UpdateCommunicationDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    this.staff.requirePermission(actor, "debtor:update");
    const existing = await this.prisma.communicationEvent.findFirst({ where: { id, tenantId }, include: this.include() });
    if (!existing) throw new NotFoundException("Kommunikation wurde nicht gefunden.");
    const caseId = dto.caseId === undefined ? existing.caseId : dto.caseId;
    await this.assertCase(caseId, existing.partyId, tenantId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.communicationEvent.update({
        where: { id },
        data: {
          caseId,
          subject: dto.subject === undefined ? undefined : dto.subject?.trim() || null,
          summary: dto.summary === undefined ? undefined : dto.summary.trim(),
        },
        include: this.include(),
      });
      await this.activity.recordStaffEvent(tx, actor.tenantMembershipId, {
        tenantId,
        partyId: item.partyId,
        caseId: item.caseId ?? undefined,
        eventType: ActivityEventType.COMMUNICATION_UPDATED,
        metadata: { communicationId: item.id },
        sourceEntityType: "CommunicationEvent",
        sourceEntityId: item.id,
      });
      return item;
    });
    return updated;
  }

  async download(id: string, attachmentId: string) {
    const tenantId = await this.tenant.getTenantId();
    this.staff.requireAnyPermission(this.tenant.getStaffContext(), ["debtor:read", "case:read"]);
    const attachment = await this.prisma.communicationAttachment.findFirst({
      where: { id: attachmentId, communicationId: id, tenantId },
    });
    if (!attachment || !(await this.storage.exists(attachment.storageKey))) {
      throw new NotFoundException("Anhang wurde nicht gefunden.");
    }
    return { attachment, buffer: await this.storage.read(attachment.storageKey) };
  }

  private async list(
    where: Prisma.CommunicationEventWhereInput,
    query: QueryCommunicationsDto,
  ) {
    const { page, limit } = query;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.communicationEvent.findMany({
        where,
        include: this.include(),
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.communicationEvent.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  private include() {
    return {
      attachments: { orderBy: { createdAt: "asc" as const } },
      case: { select: { id: true, caseNumber: true } },
      createdByMembership: { select: { user: { select: { displayName: true, email: true } } } },
    } satisfies Prisma.CommunicationEventInclude;
  }

  private async assertDebtorParty(partyId: string, tenantId: string) {
    const party = await this.prisma.party.findFirst({
      where: { id: partyId, tenantId, deletedAt: null, roles: { some: { role: PartyRoleType.DEBTOR, deletedAt: null } } },
      select: { id: true },
    });
    if (!party) throw new NotFoundException("Schuldner wurde nicht gefunden.");
  }

  private async assertExistingCase(caseId: string, tenantId: string) {
    const caseRecord = await this.prisma.case.findFirst({ where: { id: caseId, tenantId, deletedAt: null }, select: { id: true } });
    if (!caseRecord) throw new NotFoundException("Inkassoakte wurde nicht gefunden.");
  }

  private async assertCase(caseId: string | null | undefined, partyId: string, tenantId: string) {
    if (!caseId) return;
    const caseRecord = await this.prisma.case.findFirst({
      where: { id: caseId, tenantId, debtorPartyId: partyId, deletedAt: null },
      select: { id: true },
    });
    if (!caseRecord) throw new ConflictException("Die Akte gehört nicht zu diesem Schuldner.");
  }

  private assertAttachments(attachments: AttachmentInput[]) {
    if (attachments.length > MAX_ATTACHMENT_COUNT) throw new BadRequestException("Es dürfen höchstens zehn Dateien angehängt werden.");
    for (const { file } of attachments) {
      const extension = this.extension(this.safeFileName(file.originalname));
      const acceptedMimes = allowedExtensions.get(extension);
      if (!acceptedMimes || !acceptedMimes.includes(file.mimetype || "application/octet-stream")) {
        throw new BadRequestException("Dateityp ist nicht zulässig. Erlaubt sind EML, PDF, Bilder und gängige Office-Dateien.");
      }
      if (!file.size || file.size > MAX_ATTACHMENT_SIZE) {
        throw new BadRequestException("Eine Datei darf maximal 10 MB groß sein.");
      }
    }
  }

  private safeFileName(value: string) {
    const name = value.replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f]/g, "").trim();
    if (!name || name === "." || name === "..") throw new BadRequestException("Ungültiger Dateiname.");
    return name.slice(0, 255);
  }

  private extension(fileName: string) {
    return extname(fileName).slice(1).toLowerCase();
  }

  private defaultMimeType(extension: string) {
    return extension === "eml" ? "message/rfc822" : extension === "pdf" ? "application/pdf" : "application/octet-stream";
  }

  private emlMetadata(buffer: Buffer): Prisma.InputJsonValue | undefined {
    try {
      const headers = buffer.toString("utf8", 0, Math.min(buffer.length, 128 * 1024)).split(/\r?\n\r?\n/, 1)[0];
      const values = new Map<string, string>();
      let current = "";
      for (const line of headers.split(/\r?\n/)) {
        if (/^[ \t]/.test(line) && current) values.set(current, `${values.get(current) ?? ""} ${line.trim()}`);
        else {
          const match = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
          if (match) { current = match[1].toLowerCase(); values.set(current, match[2].trim()); }
          else current = "";
        }
      }
      const metadata = Object.fromEntries(["from", "to", "cc", "subject", "date", "message-id"].flatMap((key) => {
        const value = values.get(key);
        return value ? [[key === "message-id" ? "messageId" : key, value]] : [];
      }));
      return Object.keys(metadata).length ? metadata : undefined;
    } catch {
      return undefined;
    }
  }

  private activityTitle(direction: "INBOUND" | "OUTBOUND", channel: CommunicationChannel) {
    const label: Record<CommunicationChannel, string> = { PHONE: "Telefonkontakt", EMAIL: "E-Mail", LETTER: "Brief", PORTAL: "Portalnachricht", IN_PERSON: "Persönliches Gespräch", OTHER: "Kontakt" };
    return `${direction === "INBOUND" ? "Eingehender" : "Ausgehender"} ${label[channel]} erfasst`;
  }
}
