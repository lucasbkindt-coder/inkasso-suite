import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActivityEventType,
  AgentPresenceStatus,
  CallDirection,
  CallStatus,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationSource,
  ContactType,
  MembershipStatus,
  PhoneContactPreferenceValue,
  Prisma,
  TaskPriority,
  TaskStatus,
  TaskType,
  TelephonyProviderType,
  TelephonyRegistrationStatus,
} from "@prisma/client";

import { ActivityService } from "../activity/activity.service";
import { SecretEncryptionService } from "../desk-mail/secret-encryption.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import {
  CallbackTaskDto,
  CallActionDto,
  CreateStaffTelephonyAccountDto,
  MockIncomingCallDto,
  PresenceDto,
  QueryCallsDto,
  SetTelephonyCredentialsDto,
  StartCallDto,
  UpdateCallDto,
  UpdateStaffTelephonyAccountDto,
  UpsertProviderConfigDto,
} from "./dto";
import { normalizeGermanPhoneNumber } from "./phone-number";

const callInclude = {
  party: { select: { id: true, displayName: true, processingRestrictedAt: true } },
  case: { select: { id: true, caseNumber: true } },
  ticket: { select: { id: true, number: true, subject: true } },
  agentMembership: { select: { id: true, user: { select: { displayName: true, email: true } } } },
  staffTelephonyAccount: { select: { id: true, name: true, extension: true, displayNumber: true } },
  providerConfig: { select: { id: true, name: true, providerType: true } },
  communicationEvent: { select: { id: true, occurredAt: true, summary: true } },
} satisfies Prisma.TelephonyCallInclude;

const accountInclude = {
  membership: { select: { id: true, user: { select: { displayName: true, email: true } } } },
  providerConfig: true,
  credential: { select: { id: true, encryptedPayload: true } },
} satisfies Prisma.StaffTelephonyAccountInclude;

type CredentialPayload = {
  sipUsername: string;
  sipAuthId?: string;
  sipPassword: string;
  turnUsername?: string;
  turnPassword?: string;
};

@Injectable()
export class TelephonyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly activity: ActivityService,
    private readonly encryption: SecretEncryptionService,
  ) {}

  async listProviderConfigs() {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.telephonyProviderConfig.findMany({
      where: { tenantId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  async createProviderConfig(dto: UpsertProviderConfigDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const config = await this.prisma.telephonyProviderConfig.create({ data: { tenantId, ...dto } });
    await this.activity.recordStaffEvent(this.prisma, actor.tenantMembershipId, {
      tenantId,
      eventType: ActivityEventType.TELEPHONY_CONFIG_CHANGED,
      sourceEntityType: "TelephonyProviderConfig",
      sourceEntityId: config.id,
      metadata: { action: "CREATED", providerType: config.providerType, status: config.status },
    });
    return config;
  }

  async updateProviderConfig(id: string, dto: UpsertProviderConfigDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    await this.providerConfig(id, tenantId);
    const config = await this.prisma.telephonyProviderConfig.update({ where: { id }, data: dto });
    await this.activity.recordStaffEvent(this.prisma, actor.tenantMembershipId, {
      tenantId,
      eventType: ActivityEventType.TELEPHONY_CONFIG_CHANGED,
      sourceEntityType: "TelephonyProviderConfig",
      sourceEntityId: config.id,
      metadata: { action: "UPDATED", providerType: config.providerType, status: config.status },
    });
    return config;
  }

  async listAccounts(membershipId?: string) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const canManageAll = actor.permissions.includes("desk:telephony:manage");
    const target = membershipId ?? (canManageAll ? undefined : actor.tenantMembershipId);
    if (membershipId && membershipId !== actor.tenantMembershipId && !canManageAll) {
      throw new ForbiddenException("Fremde Telefoniekonten dürfen nicht angezeigt werden.");
    }
    const accounts = await this.prisma.staffTelephonyAccount.findMany({
      where: { tenantId, membershipId: target },
      include: accountInclude,
      orderBy: [{ membershipId: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    });
    return accounts.map((account) => this.serializeAccount(account));
  }

  async myTelephony() {
    const actor = this.tenant.getStaffContext();
    const accounts = await this.listAccounts(actor.tenantMembershipId);
    return { configured: accounts.some((item) => item.enabled && item.credentialsConfigured), accounts };
  }

  async createAccount(dto: CreateStaffTelephonyAccountDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    this.assertAccountAccess(dto.membershipId, true);
    await Promise.all([
      this.membership(dto.membershipId, tenantId),
      this.providerConfig(dto.telephonyProviderConfigId, tenantId),
    ]);
    const account = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.staffTelephonyAccount.updateMany({
          where: { tenantId, membershipId: dto.membershipId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.staffTelephonyAccount.create({ data: { tenantId, ...dto }, include: accountInclude });
    });
    await this.accountActivity(account.id, actor.tenantMembershipId, "CREATED", account.membershipId);
    return this.serializeAccount(account);
  }

  async updateAccount(id: string, dto: UpdateStaffTelephonyAccountDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const current = await this.account(id, tenantId);
    this.assertAccountAccess(current.membershipId, true);
    const account = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.staffTelephonyAccount.updateMany({
          where: { tenantId, membershipId: current.membershipId, id: { not: id }, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.staffTelephonyAccount.update({
        where: { id },
        data: {
          ...dto,
          registrationStatus: dto.enabled === false ? TelephonyRegistrationStatus.DISCONNECTED : undefined,
          registrationSessionId: dto.enabled === false ? null : undefined,
          registrationSessionExpiresAt: dto.enabled === false ? null : undefined,
        },
        include: accountInclude,
      });
    });
    await this.accountActivity(id, actor.tenantMembershipId, "UPDATED", account.membershipId, Object.keys(dto));
    return this.serializeAccount(account);
  }

  async removeAccount(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const current = await this.account(id, tenantId);
    this.assertAccountAccess(current.membershipId, true);
    if (await this.prisma.telephonyCall.count({ where: { staffTelephonyAccountId: id } })) {
      throw new ConflictException("Das Telefoniekonto besitzt Anrufhistorie und kann nur deaktiviert werden.");
    }
    await this.prisma.$transaction([
      this.prisma.staffTelephonyCredential.deleteMany({ where: { staffTelephonyAccountId: id } }),
      this.prisma.staffTelephonyAccount.delete({ where: { id } }),
    ]);
    await this.accountActivity(id, actor.tenantMembershipId, "REMOVED", current.membershipId);
  }

  async setCredentials(id: string, dto: SetTelephonyCredentialsDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const account = await this.account(id, tenantId);
    this.assertAccountAccess(account.membershipId, true);
    const encryptedPayload = this.encryption.encrypt(dto satisfies CredentialPayload);
    await this.prisma.staffTelephonyCredential.upsert({
      where: { staffTelephonyAccountId: id },
      create: { staffTelephonyAccountId: id, encryptedPayload },
      update: { encryptedPayload, encryptionVersion: 1 },
    });
    await this.prisma.staffTelephonyAccount.update({
      where: { id },
      data: { registrationStatus: TelephonyRegistrationStatus.DISCONNECTED, lastRegistrationError: null },
    });
    await this.accountActivity(id, actor.tenantMembershipId, "CREDENTIALS_REPLACED", account.membershipId);
    return { credentialsConfigured: true };
  }

  async deleteCredentials(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const account = await this.account(id, tenantId);
    this.assertAccountAccess(account.membershipId, true);
    await this.prisma.$transaction([
      this.prisma.staffTelephonyCredential.deleteMany({ where: { staffTelephonyAccountId: id } }),
      this.prisma.staffTelephonyAccount.update({
        where: { id },
        data: { registrationStatus: TelephonyRegistrationStatus.NOT_CONFIGURED, lastRegistrationAt: null, lastRegistrationError: null },
      }),
    ]);
    await this.accountActivity(id, actor.tenantMembershipId, "CREDENTIALS_REMOVED", account.membershipId);
    return { credentialsConfigured: false };
  }

  async testRegistration(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const account = await this.account(id, tenantId);
    this.assertAccountAccess(account.membershipId, false);
    if (!account.enabled) throw new ConflictException("Das Telefoniekonto ist deaktiviert.");
    if (!account.credential) throw new ConflictException("Für das Telefoniekonto sind keine Zugangsdaten hinterlegt.");
    if (account.providerConfig.providerType !== TelephonyProviderType.MOCK) {
      return { connected: false, registrationStatus: account.registrationStatus, message: "Für diesen Anbieter ist noch kein produktiver Adapter aktiviert." };
    }
    this.encryption.decrypt<CredentialPayload>(account.credential.encryptedPayload);
    const updated = await this.prisma.staffTelephonyAccount.update({
      where: { id },
      data: { registrationStatus: TelephonyRegistrationStatus.REGISTERED, lastRegistrationAt: new Date(), lastRegistrationError: null },
    });
    return { connected: true, registrationStatus: updated.registrationStatus, message: "MOCK-Verbindung erfolgreich geprüft." };
  }

  async resolvedAccount(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const account = await this.account(id, tenantId);
    this.assertAccountAccess(account.membershipId, false);
    return {
      id: account.id,
      providerType: account.providerConfig.providerType,
      registrar: account.registrarOverride ?? account.providerConfig.defaultRegistrar,
      proxy: account.proxyOverride ?? account.providerConfig.defaultProxy,
      domain: account.domainOverride ?? account.providerConfig.defaultDomain,
      port: account.portOverride ?? account.providerConfig.defaultPort,
      transport: account.transportOverride ?? account.providerConfig.defaultTransport,
      webSocketUrl: account.webSocketUrlOverride ?? account.providerConfig.defaultWebSocketUrl,
      stun: account.providerConfig.defaultStun,
      turn: account.providerConfig.defaultTurn,
      credentialsConfigured: Boolean(account.credential),
    };
  }

  async presence() {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    return this.prisma.agentPresence.findUnique({ where: { membershipId: actor.tenantMembershipId } })
      ?? { tenantId, membershipId: actor.tenantMembershipId, status: AgentPresenceStatus.OFFLINE, updatedAt: null };
  }

  async setPresence(dto: PresenceDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const presence = await this.prisma.agentPresence.upsert({
      where: { membershipId: actor.tenantMembershipId },
      create: { tenantId, membershipId: actor.tenantMembershipId, status: dto.status },
      update: { status: dto.status },
    });
    await this.activity.recordStaffEvent(this.prisma, actor.tenantMembershipId, {
      tenantId,
      eventType: ActivityEventType.TELEPHONY_PRESENCE_CHANGED,
      sourceEntityType: "AgentPresence",
      sourceEntityId: presence.id,
      metadata: { status: presence.status },
    });
    return presence;
  }

  async listPresence() {
    const tenantId = await this.tenant.getTenantId();
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId, status: MembershipStatus.ACTIVE, deletedAt: null },
      select: {
        id: true,
        user: { select: { displayName: true, email: true } },
        agentPresence: true,
        telephonyCalls: { where: { status: { in: [CallStatus.RINGING, CallStatus.ANSWERED, CallStatus.HELD] } }, select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((item) => ({
      membershipId: item.id,
      name: item.user.displayName ?? item.user.email,
      status: item.agentPresence?.status ?? AgentPresenceStatus.OFFLINE,
      currentCall: item.telephonyCalls[0]?.id ?? null,
    }));
  }

  async findCalls(query: QueryCallsDto) {
    const tenantId = await this.tenant.getTenantId();
    const search = query.search?.trim();
    const where: Prisma.TelephonyCallWhereInput = {
      tenantId,
      direction: query.direction,
      status: query.missed ? CallStatus.MISSED : query.status,
      agentMembershipId: query.agentMembershipId,
      startedAt: query.from || query.to ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } : undefined,
      ...(search ? { OR: [
        { remoteNumber: { contains: search, mode: "insensitive" } },
        { normalizedRemoteNumber: { contains: search } },
        { party: { is: { displayName: { contains: search, mode: "insensitive" } } } },
        { case: { is: { caseNumber: { contains: search, mode: "insensitive" } } } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.telephonyCall.findMany({ where, include: callInclude, orderBy: [{ startedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.telephonyCall.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findCall(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const call = await this.prisma.telephonyCall.findFirst({ where: { id, tenantId }, include: callInclude });
    if (!call) throw new NotFoundException("Anruf wurde nicht gefunden.");
    return { ...call, screenPop: await this.screenPop(call.normalizedRemoteNumber, call.partyId) };
  }

  async startOutgoing(dto: StartCallDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const normalized = this.requireNormalized(dto.remoteNumber);
    const account = await this.resolveActiveAccount(dto.staffTelephonyAccountId, actor.tenantMembershipId, tenantId);
    await this.assertCallLinks(tenantId, dto.partyId, dto.caseId, dto.ticketId);
    await this.assertOutgoingAllowed(tenantId, dto.partyId);
    const providerCallId = `mock-${crypto.randomUUID()}`;
    const call = await this.prisma.telephonyCall.create({
      data: {
        tenantId,
        providerConfigId: account.telephonyProviderConfigId,
        staffTelephonyAccountId: account.id,
        direction: CallDirection.OUTBOUND,
        status: CallStatus.CREATED,
        matchStatus: dto.partyId ? "MATCHED" : "UNMATCHED",
        partyId: dto.partyId,
        caseId: dto.caseId,
        ticketId: dto.ticketId,
        agentMembershipId: actor.tenantMembershipId,
        remoteNumber: dto.remoteNumber.trim(),
        normalizedRemoteNumber: normalized,
        localNumber: account.outboundCallerId ?? account.displayNumber,
        providerCallId,
      },
      include: callInclude,
    });
    await this.callActivity(call, ActivityEventType.TELEPHONY_CALL_STARTED, { direction: call.direction, accountId: account.id });
    return call;
  }

  async mockIncoming(dto: MockIncomingCallDto) {
    if (process.env.NODE_ENV === "production" || process.env.TELEPHONY_MOCK_ENABLED === "false") {
      throw new NotFoundException("MOCK-Telefonie ist nicht verfügbar.");
    }
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const normalized = this.requireNormalized(dto.remoteNumber);
    const account = await this.resolveActiveAccount(dto.staffTelephonyAccountId, actor.tenantMembershipId, tenantId);
    if (account.providerConfig.providerType !== TelephonyProviderType.MOCK) throw new ConflictException("Der gewählte Account ist kein MOCK-Account.");
    const providerCallId = dto.providerCallId?.trim() || `mock-${crypto.randomUUID()}`;
    const existing = await this.prisma.telephonyCall.findUnique({
      where: { tenantId_providerConfigId_providerCallId: { tenantId, providerConfigId: account.telephonyProviderConfigId, providerCallId } },
      include: callInclude,
    });
    if (existing) return existing;
    const match = await this.matchCaller(tenantId, normalized);
    const call = await this.prisma.telephonyCall.create({
      data: {
        tenantId,
        providerConfigId: account.telephonyProviderConfigId,
        staffTelephonyAccountId: account.id,
        direction: CallDirection.INBOUND,
        status: CallStatus.RINGING,
        matchStatus: match.status,
        matchCandidateCount: match.partyIds.length,
        partyId: match.status === "MATCHED" ? match.partyIds[0] : undefined,
        agentMembershipId: actor.tenantMembershipId,
        remoteNumber: dto.remoteNumber.trim(),
        normalizedRemoteNumber: normalized,
        localNumber: account.displayNumber,
        providerCallId,
        ringingAt: new Date(),
      },
      include: callInclude,
    });
    await this.callActivity(call, ActivityEventType.TELEPHONY_CALL_RINGING, { matchStatus: call.matchStatus, candidateCount: call.matchCandidateCount });
    if (call.matchStatus === "MATCHED") {
      await this.callActivity(call, ActivityEventType.TELEPHONY_CALL_MATCHED, { partyId: call.partyId, source: "NORMALIZED_PHONE" });
    }
    return { ...call, screenPop: await this.screenPop(normalized, call.partyId, match.partyIds) };
  }

  async callAction(id: string, dto: CallActionDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const call = await this.requiredCall(id, tenantId);
    if (call.agentMembershipId && call.agentMembershipId !== actor.tenantMembershipId && !actor.permissions.includes("desk:telephony:manage")) {
      throw new ForbiddenException("Dieser Anruf ist einem anderen Mitarbeiter zugeordnet.");
    }
    const now = new Date();
    const transition = this.transition(call.status, dto.action);
    const terminalStatuses: CallStatus[] = [CallStatus.ENDED, CallStatus.MISSED, CallStatus.FAILED];
    const terminal = terminalStatuses.includes(transition.status);
    const durationSeconds = terminal ? Math.max(0, Math.floor((now.getTime() - (call.answeredAt ?? now).getTime()) / 1000)) : undefined;
    const updated = await this.prisma.$transaction(async (tx) => {
      const value = await tx.telephonyCall.update({
        where: { id },
        data: {
          status: transition.status,
          ringingAt: transition.status === CallStatus.RINGING && !call.ringingAt ? now : undefined,
          answeredAt: transition.status === CallStatus.ANSWERED && !call.answeredAt ? now : undefined,
          endedAt: terminal ? now : undefined,
          durationSeconds,
        },
        include: callInclude,
      });
      if (terminal && !value.communicationEventId) await this.createPhoneCommunication(tx, value);
      return tx.telephonyCall.findUniqueOrThrow({ where: { id }, include: callInclude });
    });
    await this.callActivity(updated, transition.event, { status: updated.status, durationSeconds: updated.durationSeconds });
    return updated;
  }

  async updateCall(id: string, dto: UpdateCallDto) {
    const tenantId = await this.tenant.getTenantId();
    const current = await this.requiredCall(id, tenantId);
    const partyId = dto.partyId === undefined ? current.partyId : dto.partyId;
    const caseId = dto.caseId === undefined ? current.caseId : dto.caseId;
    const ticketId = dto.ticketId === undefined ? current.ticketId : dto.ticketId;
    await this.assertCallLinks(tenantId, partyId ?? undefined, caseId ?? undefined, ticketId ?? undefined);
    const value = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.telephonyCall.update({
        where: { id },
        data: {
          partyId: dto.partyId,
          caseId: dto.caseId,
          ticketId: dto.ticketId,
          disposition: dto.disposition,
          wrapUpNote: dto.wrapUpNote,
          matchStatus: dto.partyId ? "MATCHED" : undefined,
        },
        include: callInclude,
      });
      if (updated.communicationEventId) {
        await tx.communicationEvent.update({
          where: { id: updated.communicationEventId },
          data: { partyId: updated.partyId, caseId: updated.caseId, deskTicketId: updated.ticketId, summary: this.communicationSummary(updated) },
        });
      }
      return updated;
    });
    if (partyId !== current.partyId || caseId !== current.caseId || ticketId !== current.ticketId) {
      await this.callActivity(value, current.partyId ? ActivityEventType.TELEPHONY_CALL_REASSIGNED : ActivityEventType.TELEPHONY_CALL_MATCHED, { partyId, caseId, ticketId, source: "STAFF_REVIEW" });
    }
    if (dto.disposition) await this.callActivity(value, ActivityEventType.TELEPHONY_CALL_DISPOSITION_SET, { disposition: dto.disposition });
    return value;
  }

  async createCallbackTask(id: string, dto: CallbackTaskDto) {
    const tenantId = await this.tenant.getTenantId();
    const actor = this.tenant.getStaffContext();
    const call = await this.requiredCall(id, tenantId);
    if (!call.caseId) throw new ConflictException("Für eine Rückruf-Aufgabe muss der Anruf einer Akte zugeordnet sein.");
    const task = await this.prisma.caseTask.create({
      data: {
        tenantId,
        caseId: call.caseId,
        type: TaskType.TASK,
        status: TaskStatus.OPEN,
        priority: TaskPriority.NORMAL,
        title: "Rückruf",
        description: dto.note?.trim() || "Rückruf aus Telefonat",
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        assignedMembershipId: call.agentMembershipId ?? actor.tenantMembershipId,
        createdByMembershipId: actor.tenantMembershipId,
      },
    });
    await this.callActivity(call, ActivityEventType.TELEPHONY_CALLBACK_TASK_CREATED, { taskId: task.id });
    return task;
  }

  private serializeAccount(account: Prisma.StaffTelephonyAccountGetPayload<{ include: typeof accountInclude }>) {
    return {
      id: account.id,
      tenantId: account.tenantId,
      membershipId: account.membershipId,
      telephonyProviderConfigId: account.telephonyProviderConfigId,
      name: account.name,
      enabled: account.enabled,
      isDefault: account.isDefault,
      extension: account.extension,
      authUsername: account.authUsername,
      displayNumber: account.displayNumber,
      outboundCallerId: account.outboundCallerId,
      registrarOverride: account.registrarOverride,
      proxyOverride: account.proxyOverride,
      domainOverride: account.domainOverride,
      portOverride: account.portOverride,
      transportOverride: account.transportOverride,
      webSocketUrlOverride: account.webSocketUrlOverride,
      maxConcurrentCalls: account.maxConcurrentCalls,
      registrationStatus: account.registrationStatus,
      lastRegistrationAt: account.lastRegistrationAt,
      lastRegistrationError: account.lastRegistrationError,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      credentialsConfigured: Boolean(account.credential),
      membership: account.membership,
      providerConfig: account.providerConfig,
    };
  }

  private assertAccountAccess(membershipId: string, manage: boolean) {
    const actor = this.tenant.getStaffContext();
    if (actor.permissions.includes("desk:telephony:manage")) return;
    const ownPermission = manage ? "desk:telephony:manage-own" : "desk:telephony:use";
    if (membershipId !== actor.tenantMembershipId || !actor.permissions.includes(ownPermission)) {
      throw new ForbiddenException("Berechtigung für dieses Telefoniekonto fehlt.");
    }
  }

  private async account(id: string, tenantId: string) {
    const value = await this.prisma.staffTelephonyAccount.findFirst({ where: { id, tenantId }, include: accountInclude });
    if (!value) throw new NotFoundException("Telefoniekonto wurde nicht gefunden.");
    return value;
  }

  private async providerConfig(id: string, tenantId: string) {
    const value = await this.prisma.telephonyProviderConfig.findFirst({ where: { id, tenantId } });
    if (!value) throw new BadRequestException("Die Telefoniekonfiguration gehört nicht zum aktuellen Mandanten.");
    return value;
  }

  private async membership(id: string, tenantId: string) {
    const value = await this.prisma.tenantMembership.findFirst({ where: { id, tenantId, status: MembershipStatus.ACTIVE, deletedAt: null } });
    if (!value) throw new BadRequestException("Der Mitarbeiter gehört nicht zum aktuellen Mandanten.");
    return value;
  }

  private async resolveActiveAccount(id: string | undefined, membershipId: string, tenantId: string) {
    const value = await this.prisma.staffTelephonyAccount.findFirst({
      where: { tenantId, membershipId, enabled: true, ...(id ? { id } : { isDefault: true }) },
      include: { providerConfig: true, credential: true },
      orderBy: { createdAt: "asc" },
    });
    if (!value) throw new ConflictException("Telefonie ist für diesen Mitarbeiter nicht eingerichtet.");
    if (value.providerConfig.status === "DISABLED") throw new ConflictException("Die Telefoniekonfiguration ist deaktiviert.");
    return value;
  }

  private requireNormalized(value: string) {
    const normalized = normalizeGermanPhoneNumber(value);
    if (!normalized) throw new BadRequestException("Die Telefonnummer ist ungültig.");
    return normalized;
  }

  private async matchCaller(tenantId: string, normalized: string) {
    const historical = await this.prisma.telephonyCall.findMany({
      where: { tenantId, normalizedRemoteNumber: normalized, partyId: { not: null } },
      select: { partyId: true },
      distinct: ["partyId"],
    });
    const historicalIds = historical.flatMap((item) => item.partyId ? [item.partyId] : []);
    if (historicalIds.length === 1) return { status: "MATCHED" as const, partyIds: historicalIds };
    if (historicalIds.length > 1) return { status: "REVIEW_REQUIRED" as const, partyIds: historicalIds };
    const [contacts, clientContacts] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where: { party: { tenantId, deletedAt: null }, deletedAt: null, type: { in: [ContactType.PHONE, ContactType.MOBILE, ContactType.FAX] } },
        select: { value: true, partyId: true },
      }),
      this.prisma.clientContact.findMany({ where: { tenantId, isActive: true }, select: { partyId: true, phone: true, mobile: true } }),
    ]);
    const ids = new Set<string>();
    for (const item of contacts) if (normalizeGermanPhoneNumber(item.value) === normalized) ids.add(item.partyId);
    for (const item of clientContacts) {
      if ((item.phone && normalizeGermanPhoneNumber(item.phone) === normalized) || (item.mobile && normalizeGermanPhoneNumber(item.mobile) === normalized)) ids.add(item.partyId);
    }
    const partyIds = [...ids];
    return { status: partyIds.length === 1 ? "MATCHED" as const : partyIds.length ? "REVIEW_REQUIRED" as const : "UNMATCHED" as const, partyIds };
  }

  private async screenPop(normalized: string, matchedPartyId: string | null, candidatePartyIds: string[] = []) {
    const tenantId = await this.tenant.getTenantId();
    const ids = matchedPartyId ? [matchedPartyId] : candidatePartyIds;
    const parties = ids.length ? await this.prisma.party.findMany({
      where: { tenantId, id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        clientCases: { where: { deletedAt: null, status: { notIn: ["CLOSED", "CANCELLED"] } }, select: { id: true, caseNumber: true, status: true } },
        debtorCases: { where: { deletedAt: null, status: { notIn: ["CLOSED", "CANCELLED"] } }, select: { id: true, caseNumber: true, status: true } },
        deskTickets: { where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, select: { id: true, number: true, subject: true, status: true }, take: 10 },
        communications: { select: { id: true, channel: true, direction: true, occurredAt: true, summary: true }, orderBy: { occurredAt: "desc" }, take: 5 },
      },
    }) : [];
    return { normalizedRemoteNumber: normalized, parties };
  }

  private async assertCallLinks(tenantId: string, partyId?: string, caseId?: string, ticketId?: string) {
    const [party, caseRecord, ticket] = await Promise.all([
      partyId ? this.prisma.party.findFirst({ where: { id: partyId, tenantId, deletedAt: null }, select: { id: true } }) : true,
      caseId ? this.prisma.case.findFirst({ where: { id: caseId, tenantId, deletedAt: null }, select: { id: true, clientPartyId: true, debtorPartyId: true } }) : true,
      ticketId ? this.prisma.deskTicket.findFirst({ where: { id: ticketId, tenantId }, select: { id: true, partyId: true, caseId: true } }) : true,
    ]);
    if (!party || !caseRecord || !ticket) throw new BadRequestException("Mindestens eine Zuordnung gehört nicht zum aktuellen Mandanten.");
    if (partyId && typeof caseRecord !== "boolean" && ![caseRecord.clientPartyId, caseRecord.debtorPartyId].includes(partyId)) throw new BadRequestException("Partei und Akte passen nicht zusammen.");
    if (typeof ticket !== "boolean" && partyId && ticket.partyId && ticket.partyId !== partyId) throw new BadRequestException("Partei und Ticket passen nicht zusammen.");
    if (typeof ticket !== "boolean" && caseId && ticket.caseId && ticket.caseId !== caseId) throw new BadRequestException("Akte und Ticket passen nicht zusammen.");
  }

  private async assertOutgoingAllowed(tenantId: string, partyId?: string) {
    if (!partyId) return;
    const party = await this.prisma.party.findFirst({ where: { id: partyId, tenantId }, select: { processingRestrictedAt: true } });
    if (party?.processingRestrictedAt) throw new ConflictException("Die Verarbeitung dieser Partei ist eingeschränkt. Ausgehende Anrufe sind gesperrt.");
    const blocked = await this.prisma.phoneContactPreference.findFirst({ where: { tenantId, partyId, preference: PhoneContactPreferenceValue.PHONE_BLOCKED } });
    if (blocked) throw new ConflictException("Für diese Partei ist telefonische Kontaktaufnahme gesperrt.");
  }

  private transition(status: CallStatus, action: CallActionDto["action"]) {
    const map: Record<CallActionDto["action"], { allowed: CallStatus[]; status: CallStatus; event: ActivityEventType }> = {
      ring: { allowed: [CallStatus.CREATED], status: CallStatus.RINGING, event: ActivityEventType.TELEPHONY_CALL_RINGING },
      answer: { allowed: [CallStatus.CREATED, CallStatus.RINGING], status: CallStatus.ANSWERED, event: ActivityEventType.TELEPHONY_CALL_ANSWERED },
      hold: { allowed: [CallStatus.ANSWERED], status: CallStatus.HELD, event: ActivityEventType.TELEPHONY_CALL_HELD },
      resume: { allowed: [CallStatus.HELD], status: CallStatus.ANSWERED, event: ActivityEventType.TELEPHONY_CALL_RESUMED },
      mute: { allowed: [CallStatus.ANSWERED, CallStatus.HELD], status, event: ActivityEventType.TELEPHONY_CALL_ANSWERED },
      unmute: { allowed: [CallStatus.ANSWERED, CallStatus.HELD], status, event: ActivityEventType.TELEPHONY_CALL_ANSWERED },
      dtmf: { allowed: [CallStatus.ANSWERED], status, event: ActivityEventType.TELEPHONY_CALL_ANSWERED },
      end: { allowed: [CallStatus.CREATED, CallStatus.RINGING, CallStatus.ANSWERED, CallStatus.HELD], status: CallStatus.ENDED, event: ActivityEventType.TELEPHONY_CALL_ENDED },
      miss: { allowed: [CallStatus.CREATED, CallStatus.RINGING], status: CallStatus.MISSED, event: ActivityEventType.TELEPHONY_CALL_ENDED },
      fail: { allowed: [CallStatus.CREATED, CallStatus.RINGING, CallStatus.ANSWERED, CallStatus.HELD], status: CallStatus.FAILED, event: ActivityEventType.TELEPHONY_CALL_FAILED },
    };
    const value = map[action];
    if (!value.allowed.includes(status)) throw new ConflictException(`Aktion ${action} ist im Status ${status} nicht zulässig.`);
    return value;
  }

  private async requiredCall(id: string, tenantId: string) {
    const value = await this.prisma.telephonyCall.findFirst({ where: { id, tenantId }, include: callInclude });
    if (!value) throw new NotFoundException("Anruf wurde nicht gefunden.");
    return value;
  }

  private async createPhoneCommunication(tx: Prisma.TransactionClient, call: Prisma.TelephonyCallGetPayload<{ include: typeof callInclude }>) {
    const communication = await tx.communicationEvent.create({
      data: {
        tenantId: call.tenantId,
        partyId: call.partyId,
        caseId: call.caseId,
        deskTicketId: call.ticketId,
        direction: call.direction === CallDirection.INBOUND ? CommunicationDirection.INBOUND : CommunicationDirection.OUTBOUND,
        channel: CommunicationChannel.PHONE,
        source: CommunicationSource.EXTERNAL,
        occurredAt: call.startedAt,
        subject: call.status === CallStatus.MISSED ? "Verpasster Anruf" : "Telefonat",
        summary: this.communicationSummary(call),
        durationSeconds: call.durationSeconds,
        externalReference: call.providerCallId,
        createdByMembershipId: call.agentMembershipId,
      },
    });
    await tx.telephonyCall.update({ where: { id: call.id }, data: { communicationEventId: communication.id } });
  }

  private communicationSummary(call: { direction: CallDirection; status: CallStatus; durationSeconds: number | null; disposition: string | null; wrapUpNote: string | null }) {
    const direction = call.direction === CallDirection.INBOUND ? "Eingehender" : "Ausgehender";
    const duration = call.durationSeconds == null ? "" : `, Dauer ${call.durationSeconds} Sekunden`;
    const disposition = call.disposition ? `, Ergebnis ${call.disposition}` : "";
    const note = call.wrapUpNote ? ` – ${call.wrapUpNote}` : "";
    return `${direction} Anruf (${call.status}${duration}${disposition})${note}`;
  }

  private async callActivity(call: { id: string; tenantId: string; caseId: string | null; partyId: string | null; ticketId: string | null; agentMembershipId: string | null }, eventType: ActivityEventType, metadata: Prisma.InputJsonValue) {
    const actor = this.tenant.getStaffContext();
    await this.activity.recordStaffEvent(this.prisma, actor.tenantMembershipId, {
      tenantId: call.tenantId,
      caseId: call.caseId ?? undefined,
      partyId: call.partyId ?? undefined,
      deskTicketId: call.ticketId ?? undefined,
      eventType,
      sourceEntityType: "TelephonyCall",
      sourceEntityId: call.id,
      metadata,
    });
  }

  private accountActivity(id: string, actorMembershipId: string, action: string, membershipId: string, changedFields?: string[]) {
    return this.activity.recordStaffEvent(this.prisma, actorMembershipId, {
      tenantId: this.tenant.getStaffContext().tenantId,
      eventType: ActivityEventType.TELEPHONY_ACCOUNT_CHANGED,
      sourceEntityType: "StaffTelephonyAccount",
      sourceEntityId: id,
      metadata: { action, membershipId, ...(changedFields ? { changedFields } : {}) },
    });
  }
}
