import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ActivityEventType,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationSource,
  DeskTicketPriority,
  DeskTicketStatus,
  MembershipStatus,
  PartyRoleType,
  Prisma,
  TaskStatus,
} from "@prisma/client";

import { ActivityService } from "../activity/activity.service";
import { LocalDocumentStorage } from "../documents/local-document-storage";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { allocateDeskTicketNumber } from "./desk-ticket-number.service";
import { CreateDeskNoteDto } from "./dto/create-desk-note.dto";
import { CreateDeskTicketDto } from "./dto/create-desk-ticket.dto";
import { QueryDeskTicketsDto } from "./dto/query-desk-tickets.dto";
import { UpdateDeskTicketDto } from "./dto/update-desk-ticket.dto";

const ticketListInclude = {
  party: { select: { id: true, displayName: true, type: true, processingRestrictedAt: true } },
  case: { select: { id: true, caseNumber: true } },
  assigneeMembership: { select: { id: true, user: { select: { displayName: true, email: true } } } },
  team: { select: { id: true, name: true } },
} satisfies Prisma.DeskTicketInclude;

const ticketDetailInclude = {
  ...ticketListInclude,
  createdByMembership: { select: { id: true, user: { select: { displayName: true, email: true } } } },
  communications: {
    include: {
      createdByMembership: { select: { id: true, user: { select: { displayName: true, email: true } } } },
      attachments: { orderBy: { createdAt: "asc" as const } },
    },
    orderBy: [{ occurredAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.DeskTicketInclude;

@Injectable()
export class DeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly activity: ActivityService,
    private readonly storage: LocalDocumentStorage,
  ) {}

  publicConfig() {
    const configured = process.env.DESK_PUBLIC_BASE_URL?.trim();
    return { publicBaseUrl: configured || "http://localhost:3002" };
  }

  async dashboard() {
    const tenantId = await this.tenant.getTenantId();
    const membershipId = this.tenant.getStaffContext().tenantMembershipId;
    const openStatuses = [DeskTicketStatus.OPEN, DeskTicketStatus.PENDING, DeskTicketStatus.WAITING];
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [mine, unassigned, open, waiting, completedToday] = await this.prisma.$transaction([
      this.prisma.deskTicket.count({ where: { tenantId, assigneeMembershipId: membershipId, status: { in: openStatuses } } }),
      this.prisma.deskTicket.count({ where: { tenantId, assigneeMembershipId: null, status: { in: openStatuses } } }),
      this.prisma.deskTicket.count({ where: { tenantId, status: { in: openStatuses } } }),
      this.prisma.deskTicket.count({ where: { tenantId, status: DeskTicketStatus.WAITING } }),
      this.prisma.deskTicket.count({ where: { tenantId, status: { in: [DeskTicketStatus.RESOLVED, DeskTicketStatus.CLOSED] }, closedAt: { gte: startOfDay } } }),
    ]);
    return { mine, unassigned, open, waiting, completedToday };
  }

  async findAll(query: QueryDeskTicketsDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    if (query.mine && query.unassigned) {
      throw new BadRequestException("Eigene und nicht zugewiesene Tickets können nicht gleichzeitig gefiltert werden.");
    }
    const search = query.search?.trim();
    const where: Prisma.DeskTicketWhereInput = {
      tenantId,
      status: query.status,
      priority: query.priority,
      partyId: query.partyId,
      caseId: query.caseId,
      assigneeMembershipId: query.mine
        ? actor.tenantMembershipId
        : query.unassigned
          ? null
          : query.assigneeMembershipId,
    };
    if (search) {
      where.OR = [
        { number: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { party: { is: { displayName: { contains: search, mode: "insensitive" } } } },
        { case: { is: { caseNumber: { contains: search, mode: "insensitive" } } } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deskTicket.findMany({
        where,
        include: ticketListInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.deskTicket.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const ticket = await this.prisma.deskTicket.findFirst({ where: { id, tenantId }, include: ticketDetailInclude });
    if (!ticket) throw new NotFoundException("Ticket wurde nicht gefunden.");
    const tasks = ticket.caseId
      ? await this.prisma.caseTask.findMany({
          where: { tenantId, caseId: ticket.caseId, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] } },
          select: { id: true, title: true, status: true, priority: true, dueAt: true },
          orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
          take: 10,
        })
      : [];
    return { ...ticket, openTasks: tasks };
  }

  async create(dto: CreateDeskTicketDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const party = dto.partyId ? await this.assertParty(dto.partyId, tenantId) : null;
    const caseRecord = dto.caseId ? await this.assertCase(dto.caseId, tenantId) : null;
    this.assertPartyMatchesCase(party?.id ?? null, caseRecord);
    if (dto.assigneeMembershipId || dto.teamId) {
      this.requireAssignPermission();
    }
    if (dto.assigneeMembershipId) {
      await this.assertMembership(dto.assigneeMembershipId, tenantId);
    }
    if (dto.teamId) await this.assertTeam(dto.teamId, tenantId);
    const note = dto.firstInternalNote?.trim();
    return this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const number = await allocateDeskTicketNumber(tx, tenantId, year);
      const ticket = await tx.deskTicket.create({
        data: {
          tenantId,
          ...number,
          subject: dto.subject.trim(),
          priority: dto.priority,
          category: dto.category?.trim() || null,
          partyId: party?.id,
          caseId: caseRecord?.id,
          assigneeMembershipId: dto.assigneeMembershipId,
          teamId: dto.teamId,
          createdByMembershipId: actor.tenantMembershipId,
        },
      });
      await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_CREATED, {
        number: ticket.number,
        priority: ticket.priority,
      }, ticket.caseId, ticket.partyId);
      if (ticket.assigneeMembershipId) {
        await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_ASSIGNEE_CHANGED, {
          previousAssigneeMembershipId: null,
          assigneeMembershipId: ticket.assigneeMembershipId,
        }, ticket.caseId, ticket.partyId);
      }
      if (ticket.partyId) {
        await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_PARTY_LINKED, {
          previousPartyId: null,
          partyId: ticket.partyId,
        }, ticket.caseId, ticket.partyId);
      }
      if (ticket.caseId) {
        await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_CASE_LINKED, {
          previousCaseId: null,
          caseId: ticket.caseId,
        }, ticket.caseId, ticket.partyId);
      }
      if (note) await this.createNoteInTransaction(tx, ticket, note);
      return this.findOneWithClient(tx, ticket.id, tenantId);
    });
  }

  async update(id: string, dto: UpdateDeskTicketDto) {
    const tenantId = await this.tenant.getTenantId();
    const current = await this.findTicket(id, tenantId);
    if (dto.assigneeMembershipId !== undefined || dto.teamId !== undefined) this.requireAssignPermission();
    const partyId = dto.partyId === undefined ? current.partyId : dto.partyId;
    const caseId = dto.caseId === undefined ? current.caseId : dto.caseId;
    const party = partyId ? await this.assertParty(partyId, tenantId) : null;
    const caseRecord = caseId ? await this.assertCase(caseId, tenantId) : null;
    this.assertPartyMatchesCase(party?.id ?? null, caseRecord);
    if (dto.assigneeMembershipId) await this.assertMembership(dto.assigneeMembershipId, tenantId);
    if (dto.teamId) await this.assertTeam(dto.teamId, tenantId);
    const terminal = dto.status === DeskTicketStatus.RESOLVED || dto.status === DeskTicketStatus.CLOSED;
    const reopened = dto.status && !terminal;
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.deskTicket.update({
        where: { id },
        data: {
          subject: dto.subject?.trim(),
          status: dto.status,
          priority: dto.priority,
          category: dto.category === undefined ? undefined : dto.category?.trim() || null,
          partyId: dto.partyId,
          caseId: dto.caseId,
          assigneeMembershipId: dto.assigneeMembershipId,
          teamId: dto.teamId,
          closedAt: terminal ? new Date() : reopened ? null : undefined,
        },
      });
      if (dto.status && dto.status !== current.status) {
        await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_STATUS_CHANGED, { previousStatus: current.status, status: ticket.status }, ticket.caseId, ticket.partyId);
      }
      if (dto.priority && dto.priority !== current.priority) {
        await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_PRIORITY_CHANGED, { previousPriority: current.priority, priority: ticket.priority }, ticket.caseId, ticket.partyId);
      }
      if (dto.assigneeMembershipId !== undefined && dto.assigneeMembershipId !== current.assigneeMembershipId) {
        await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_ASSIGNEE_CHANGED, { previousAssigneeMembershipId: current.assigneeMembershipId, assigneeMembershipId: ticket.assigneeMembershipId }, ticket.caseId, ticket.partyId);
      }
      if (dto.partyId !== undefined && dto.partyId !== current.partyId) {
        await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_PARTY_LINKED, { previousPartyId: current.partyId, partyId: ticket.partyId }, ticket.caseId, ticket.partyId);
      }
      if (dto.caseId !== undefined && dto.caseId !== current.caseId) {
        await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_CASE_LINKED, { previousCaseId: current.caseId, caseId: ticket.caseId }, ticket.caseId, ticket.partyId);
      }
      return this.findOneWithClient(tx, ticket.id, tenantId);
    });
  }

  async addInternalNote(id: string, dto: CreateDeskNoteDto) {
    const tenantId = await this.tenant.getTenantId();
    const ticket = await this.findTicket(id, tenantId);
    const message = dto.message.trim();
    if (!message) throw new BadRequestException("Eine interne Notiz ist erforderlich.");
    return this.prisma.$transaction(async (tx) => {
      await this.createNoteInTransaction(tx, ticket, message);
      await tx.deskTicket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
      return this.findOneWithClient(tx, ticket.id, tenantId);
    });
  }

  async options() {
    const tenantId = await this.tenant.getTenantId();
    const [memberships, teams] = await this.prisma.$transaction([
      this.prisma.tenantMembership.findMany({
        where: { tenantId, status: MembershipStatus.ACTIVE, deletedAt: null, user: { isActive: true, deletedAt: null } },
        select: { id: true, user: { select: { displayName: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.team.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return {
      memberships: memberships.map((item) => ({ id: item.id, name: item.user.displayName ?? item.user.email })),
      teams,
    };
  }

  async searchParties(search: string) {
    const tenantId = await this.tenant.getTenantId();
    const value = search.trim();
    if (value.length < 2) return [];
    return this.prisma.party.findMany({
      where: {
        tenantId,
        deletedAt: null,
        displayName: { contains: value, mode: "insensitive" },
        roles: { some: { role: { in: [PartyRoleType.CLIENT, PartyRoleType.DEBTOR] }, deletedAt: null } },
      },
      select: { id: true, displayName: true, type: true, roles: { where: { deletedAt: null }, select: { role: true } } },
      orderBy: { displayName: "asc" },
      take: 20,
    });
  }

  async searchCases(search: string) {
    const tenantId = await this.tenant.getTenantId();
    const value = search.trim();
    if (value.length < 2) return [];
    return this.prisma.case.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { caseNumber: { contains: value, mode: "insensitive" } },
          { clientParty: { displayName: { contains: value, mode: "insensitive" } } },
          { debtorParty: { displayName: { contains: value, mode: "insensitive" } } },
        ],
      },
      select: { id: true, caseNumber: true, clientParty: { select: { id: true, displayName: true } }, debtorParty: { select: { id: true, displayName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
  }

  async partyContext(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const party = await this.prisma.party.findFirst({
      where: { id, tenantId, deletedAt: null, roles: { some: { role: { in: [PartyRoleType.CLIENT, PartyRoleType.DEBTOR] }, deletedAt: null } } },
      select: { id: true, displayName: true, type: true, processingRestrictedAt: true, roles: { where: { deletedAt: null }, select: { role: true } } },
    });
    if (!party) throw new NotFoundException("Partei wurde nicht gefunden.");
    return party;
  }

  async caseContext(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const record = await this.prisma.case.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, caseNumber: true, clientParty: { select: { id: true, displayName: true } }, debtorParty: { select: { id: true, displayName: true, processingRestrictedAt: true } } },
    });
    if (!record) throw new NotFoundException("Inkassoakte wurde nicht gefunden.");
    return record;
  }

  async downloadAttachment(ticketId: string, communicationId: string, attachmentId: string) {
    const tenantId = await this.tenant.getTenantId();
    const attachment = await this.prisma.communicationAttachment.findFirst({
      where: {
        id: attachmentId,
        communicationId,
        tenantId,
        communication: { deskTicketId: ticketId, tenantId },
      },
    });
    if (!attachment || !(await this.storage.exists(attachment.storageKey))) {
      throw new NotFoundException("Anhang wurde nicht gefunden.");
    }
    return { attachment, buffer: await this.storage.read(attachment.storageKey) };
  }

  private async createNoteInTransaction(
    tx: Prisma.TransactionClient,
    ticket: { id: string; tenantId: string; partyId: string | null; caseId: string | null },
    message: string,
  ) {
    const actor = this.tenant.getStaffContext();
    const communication = await tx.communicationEvent.create({
      data: {
        tenantId: ticket.tenantId,
        deskTicketId: ticket.id,
        partyId: ticket.partyId,
        caseId: ticket.caseId,
        direction: CommunicationDirection.INTERNAL,
        channel: CommunicationChannel.INTERNAL,
        source: CommunicationSource.MANUAL,
        occurredAt: new Date(),
        summary: message,
        createdByMembershipId: actor.tenantMembershipId,
      },
    });
    await this.record(tx, ticket.id, ActivityEventType.DESK_TICKET_COMMENT_ADDED, { communicationId: communication.id }, ticket.caseId, ticket.partyId);
    return communication;
  }

  private record(
    tx: Prisma.TransactionClient,
    ticketId: string,
    eventType: ActivityEventType,
    metadata: Prisma.InputJsonValue,
    caseId: string | null,
    partyId: string | null,
  ) {
    return this.activity.recordStaffEvent(tx, this.tenant.getStaffContext().tenantMembershipId, {
      tenantId: this.tenant.getStaffContext().tenantId,
      deskTicketId: ticketId,
      caseId: caseId ?? undefined,
      partyId: partyId ?? undefined,
      eventType,
      metadata,
      sourceEntityType: "DeskTicket",
      sourceEntityId: ticketId,
    });
  }

  private async findTicket(id: string, tenantId: string) {
    const ticket = await this.prisma.deskTicket.findFirst({ where: { id, tenantId } });
    if (!ticket) throw new NotFoundException("Ticket wurde nicht gefunden.");
    return ticket;
  }

  private async findOneWithClient(client: Prisma.TransactionClient, id: string, tenantId: string) {
    const ticket = await client.deskTicket.findFirst({ where: { id, tenantId }, include: ticketDetailInclude });
    if (!ticket) throw new NotFoundException("Ticket wurde nicht gefunden.");
    return { ...ticket, openTasks: [] };
  }

  private async assertParty(id: string, tenantId: string) {
    const party = await this.prisma.party.findFirst({
      where: { id, tenantId, deletedAt: null, roles: { some: { role: { in: [PartyRoleType.CLIENT, PartyRoleType.DEBTOR] }, deletedAt: null } } },
      select: { id: true, processingRestrictedAt: true },
    });
    if (!party) throw new BadRequestException("Die Partei gehört nicht zum aktiven Mandanten.");
    return party;
  }

  private async assertCase(id: string, tenantId: string) {
    const record = await this.prisma.case.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, clientPartyId: true, debtorPartyId: true },
    });
    if (!record) throw new BadRequestException("Die Akte gehört nicht zum aktiven Mandanten.");
    return record;
  }

  private assertPartyMatchesCase(
    partyId: string | null,
    caseRecord: { clientPartyId: string; debtorPartyId: string } | null,
  ) {
    if (partyId && caseRecord && ![caseRecord.clientPartyId, caseRecord.debtorPartyId].includes(partyId)) {
      throw new BadRequestException("Die Partei ist kein Beteiligter der ausgewählten Inkassoakte.");
    }
  }

  private async assertMembership(id: string, tenantId: string) {
    const membership = await this.prisma.tenantMembership.findFirst({ where: { id, tenantId, status: MembershipStatus.ACTIVE, deletedAt: null, user: { isActive: true, deletedAt: null } }, select: { id: true } });
    if (!membership) throw new BadRequestException("Die zugewiesene Person gehört nicht zum aktiven Mandanten.");
  }

  private async assertTeam(id: string, tenantId: string) {
    const team = await this.prisma.team.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!team) throw new BadRequestException("Das Team gehört nicht zum aktiven Mandanten.");
  }

  private requireAssignPermission() {
    if (!this.tenant.getStaffContext().permissions.includes("desk:assign")) {
      throw new ForbiddenException("Für die Ticketzuweisung ist desk:assign erforderlich.");
    }
  }
}
