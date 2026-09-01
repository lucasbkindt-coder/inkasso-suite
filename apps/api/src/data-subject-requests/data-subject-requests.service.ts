import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DataSubjectDataAction, DataSubjectDataCategory, DataSubjectRequestStatus, DataSubjectRequestType, MembershipStatus, Prisma } from "@prisma/client";

import { ActivityService } from "../activity/activity.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateDataSubjectRequestDto, ReviewDataDto, UpdateDataSubjectRequestDto, VerifyIdentityDto } from "./dto";
import { markCreditReportsForPartyReview } from "../credit-reporting/credit-report-state";

const categories = Object.values(DataSubjectDataCategory);

@Injectable()
export class DataSubjectRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly activity: ActivityService,
  ) {}

  async list() {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.dataSubjectRequest.findMany({
      where: { tenantId },
      include: {
        subjectParty: { select: { displayName: true } },
        clientContact: { select: { firstName: true, lastName: true } },
        assignedMembership: { select: { user: { select: { displayName: true, email: true } } } },
        exports: { select: { id: true } },
      },
      orderBy: { receivedAt: "desc" },
    });
  }

  async get(id: string) {
    const item = await this.find(id);
    return { ...item, exports: item.exports.map(({ snapshot, ...value }) => value) };
  }

  async options() {
    const tenantId = await this.tenant.getTenantId();
    const [parties, clientContacts, assignees] = await Promise.all([
      this.prisma.party.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, displayName: true, type: true },
        orderBy: { displayName: "asc" },
      }),
      this.prisma.clientContact.findMany({
        where: { tenantId, isActive: true, party: { deletedAt: null, roles: { some: { role: "CLIENT", deletedAt: null } } } },
        select: { id: true, firstName: true, lastName: true, email: true, party: { select: { displayName: true } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      this.prisma.tenantMembership.findMany({
        where: { tenantId, status: MembershipStatus.ACTIVE, deletedAt: null, user: { isActive: true, deletedAt: null } },
        select: { id: true, user: { select: { displayName: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { parties, clientContacts, assignees };
  }

  async create(dto: CreateDataSubjectRequestDto) {
    const tenantId = await this.tenant.getTenantId();
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    if (Boolean(dto.subjectPartyId) === Boolean(dto.clientContactId)) throw new BadRequestException("Bitte genau eine betroffene Partei oder einen Ansprechpartner auswählen.");
    if (dto.subjectPartyId && !(await this.prisma.party.findFirst({ where: { id: dto.subjectPartyId, tenantId, deletedAt: null } }))) throw new BadRequestException("Betroffene Partei wurde nicht gefunden.");
    if (dto.clientContactId && !(await this.prisma.clientContact.findFirst({ where: { id: dto.clientContactId, tenantId, isActive: true } }))) throw new BadRequestException("Betroffener Ansprechpartner wurde nicht gefunden.");
    if (dto.assignedMembershipId) await this.assertActiveAssignee(this.prisma, tenantId, dto.assignedMembershipId);
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    if (dueAt && dueAt < receivedAt) throw new BadRequestException("Die Frist darf nicht vor dem Eingangsdatum liegen.");
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.dataSubjectRequest.create({ data: {
        tenantId, subjectPartyId: dto.subjectPartyId, clientContactId: dto.clientContactId,
        requestType: dto.requestType, receivedAt, dueAt, assignedMembershipId: dto.assignedMembershipId,
        description: dto.description?.trim() || undefined, createdByMembershipId: actorMembershipId,
      } });
      if (dto.requestType === DataSubjectRequestType.ERASURE) {
        const inventory = await this.inventory(
          tx,
          tenantId,
          item.subjectPartyId,
          item.clientContactId,
        );
        await tx.dataSubjectDataReview.createMany({
          data: categories.map((category) => ({
            tenantId,
            requestId: item.id,
            category,
            recordCount: inventory[category],
            proposedAction: DataSubjectDataAction.REVIEW,
          })),
        });
      }
      await this.activity.recordStaffEvent(tx, actorMembershipId, { tenantId, eventType: "DATA_SUBJECT_REQUEST_CREATED", sourceEntityType: "DataSubjectRequest", sourceEntityId: item.id, metadata: { requestType: item.requestType } });
      if (item.assignedMembershipId) await this.activity.recordStaffEvent(tx, actorMembershipId, { tenantId, eventType: "DATA_SUBJECT_REQUEST_ASSIGNED", sourceEntityType: "DataSubjectRequest", sourceEntityId: item.id, metadata: { assignedMembershipId: item.assignedMembershipId } });
      return item;
    });
  }

  async update(id: string, dto: UpdateDataSubjectRequestDto) {
    const item = await this.find(id);
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    if (dto.assignedMembershipId) await this.assertActiveAssignee(this.prisma, item.tenantId, dto.assignedMembershipId);
    if (dto.status === DataSubjectRequestStatus.COMPLETED) await this.assertCompletable(item);
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    if (dueAt && dueAt < item.receivedAt) throw new BadRequestException("Die Frist darf nicht vor dem Eingangsdatum liegen.");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.dataSubjectRequest.update({ where: { id: item.id }, data: {
        status: dto.status, assignedMembershipId: dto.assignedMembershipId, dueAt,
        notes: dto.notes?.trim() || undefined, decision: dto.decision?.trim() || undefined,
        decisionReason: dto.decisionReason?.trim() || undefined,
        completedAt: dto.status === DataSubjectRequestStatus.COMPLETED ? new Date() : undefined,
      } });
      if (dto.assignedMembershipId && dto.assignedMembershipId !== item.assignedMembershipId) await this.activity.recordStaffEvent(tx, actorMembershipId, { tenantId: item.tenantId, eventType: "DATA_SUBJECT_REQUEST_ASSIGNED", sourceEntityType: "DataSubjectRequest", sourceEntityId: item.id, metadata: { assignedMembershipId: dto.assignedMembershipId } });
      if (dto.status && dto.status !== item.status) {
        await this.activity.recordStaffEvent(tx, actorMembershipId, { tenantId: item.tenantId, eventType: "DATA_SUBJECT_REQUEST_STATUS_CHANGED", sourceEntityType: "DataSubjectRequest", sourceEntityId: item.id, metadata: { from: item.status, to: dto.status } });
        if (dto.status === DataSubjectRequestStatus.COMPLETED) await this.activity.recordStaffEvent(tx, actorMembershipId, { tenantId: item.tenantId, eventType: "DATA_SUBJECT_REQUEST_COMPLETED", sourceEntityType: "DataSubjectRequest", sourceEntityId: item.id });
      }
      return updated;
    });
  }

  async verify(id: string, dto: VerifyIdentityDto) {
    const item = await this.find(id);
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    const verifiedAt = dto.verifiedAt ? new Date(dto.verifiedAt) : new Date();
    if (verifiedAt > new Date()) throw new BadRequestException("Das Prüfdatum darf nicht in der Zukunft liegen.");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.dataSubjectRequest.update({ where: { id: item.id }, data: { identityVerifiedAt: verifiedAt, identityVerifiedByMembershipId: actorMembershipId, identityVerificationNote: dto.note?.trim() || undefined, status: DataSubjectRequestStatus.IN_REVIEW } });
      await this.activity.recordStaffEvent(tx, actorMembershipId, { tenantId: item.tenantId, eventType: "DATA_SUBJECT_IDENTITY_VERIFIED", sourceEntityType: "DataSubjectRequest", sourceEntityId: item.id, metadata: { verifiedAt: verifiedAt.toISOString() } });
      if (item.status !== DataSubjectRequestStatus.IN_REVIEW) await this.recordStatusChanged(tx, item, DataSubjectRequestStatus.IN_REVIEW);
      return updated;
    });
  }

  async export(id: string) {
    const item = await this.find(id);
    if (item.requestType !== DataSubjectRequestType.ACCESS) throw new BadRequestException("Ein Auskunftsexport ist nur für Auskunftsersuchen möglich.");
    if (!item.identityVerifiedAt) throw new ConflictException("Die Identität muss vor der Auskunftserstellung geprüft werden.");
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    const snapshot = await this.snapshot(item);
    const json = JSON.stringify(snapshot);
    return this.prisma.$transaction(async (tx) => {
      const value = await tx.dataSubjectAccessExport.create({ data: { tenantId: item.tenantId, requestId: item.id, snapshot: JSON.parse(json), sha256: createHash("sha256").update(json).digest("hex"), generatedByMembershipId: actorMembershipId } });
      await this.activity.recordStaffEvent(tx, actorMembershipId, { tenantId: item.tenantId, eventType: "DATA_SUBJECT_ACCESS_EXPORT_GENERATED", sourceEntityType: "DataSubjectAccessExport", sourceEntityId: value.id, metadata: { requestId: item.id, format: value.format } });
      return value;
    });
  }

  async review(id: string, category: string, dto: ReviewDataDto) {
    const item = await this.find(id);
    if (item.requestType !== DataSubjectRequestType.ERASURE || !categories.includes(category as DataSubjectDataCategory)) throw new BadRequestException("Ungültige Löschprüfung.");
    if (dto.finalAction !== DataSubjectDataAction.REVIEW && !dto.reason?.trim()) throw new BadRequestException("Für die finale Entscheidung ist eine Begründung erforderlich.");
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    return this.prisma.$transaction(async (tx) => {
      const value = await tx.dataSubjectDataReview.update({ where: { requestId_category: { requestId: item.id, category: category as DataSubjectDataCategory } }, data: { finalAction: dto.finalAction, reason: dto.reason?.trim() || null, reviewedAt: new Date(), reviewedByMembershipId: actorMembershipId } });
      await this.activity.recordStaffEvent(tx, actorMembershipId, { tenantId: item.tenantId, eventType: "DATA_SUBJECT_REVIEW_DECIDED", sourceEntityType: "DataSubjectDataReview", sourceEntityId: value.id, metadata: { requestId: item.id, category: value.category, action: value.finalAction } });
      return value;
    });
  }

  async applyRestriction(id: string, reason?: string) { return this.changeRestriction(id, true, reason); }
  async removeRestriction(id: string, reason?: string) { return this.changeRestriction(id, false, reason); }

  async download(id: string, exportId: string) {
    const item = await this.find(id);
    const value = await this.prisma.dataSubjectAccessExport.findFirst({ where: { id: exportId, requestId: item.id, tenantId: item.tenantId }, select: { id: true, snapshot: true } });
    if (!value) throw new NotFoundException("Auskunftsexport wurde nicht gefunden.");
    return { filename: `data-subject-access-${item.id}-${value.id}.json`, content: JSON.stringify(value.snapshot, null, 2) };
  }

  private async changeRestriction(id: string, apply: boolean, reason?: string) {
    const item = await this.find(id);
    if (item.requestType !== DataSubjectRequestType.RESTRICTION || !item.subjectPartyId) throw new BadRequestException("Eine Einschränkung ist nur für ein parteibezogenes Einschränkungsersuchen möglich.");
    if (!reason?.trim()) throw new BadRequestException(apply ? "Für die Einschränkung ist eine Begründung erforderlich." : "Für die Aufhebung ist eine Begründung erforderlich.");
    const actorMembershipId = this.tenant.getStaffContext().tenantMembershipId;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.party.update({ where: { id: item.subjectPartyId! }, data: apply ? { processingRestrictedAt: now, processingRestrictionReason: reason.trim() } : { processingRestrictedAt: null, processingRestrictionReason: null } });
      await tx.dataSubjectRequest.update({ where: { id: item.id }, data: { decision: apply ? "Verarbeitung eingeschränkt" : "Verarbeitungseinschränkung aufgehoben", decisionReason: reason.trim(), status: DataSubjectRequestStatus.APPROVED } });
      await this.activity.recordStaffEvent(tx, actorMembershipId, { tenantId: item.tenantId, partyId: item.subjectPartyId!, eventType: apply ? "DATA_SUBJECT_RESTRICTION_APPLIED" : "DATA_SUBJECT_RESTRICTION_REMOVED", description: apply ? "Verarbeitung eingeschränkt." : "Verarbeitungseinschränkung aufgehoben.", sourceEntityType: "DataSubjectRequest", sourceEntityId: item.id });
      await markCreditReportsForPartyReview(tx, { tenantId: item.tenantId, partyId: item.subjectPartyId!, reasonCode: apply ? "PROCESSING_RESTRICTION_APPLIED" : "PROCESSING_RESTRICTION_REMOVED", actorMembershipId });
      if (item.status !== DataSubjectRequestStatus.APPROVED) await this.recordStatusChanged(tx, item, DataSubjectRequestStatus.APPROVED);
    });
    return apply ? { restrictedAt: now } : { restricted: false };
  }

  private async find(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const item = await this.prisma.dataSubjectRequest.findFirst({ where: { id, tenantId }, include: {
      exports: { include: { generatedByMembership: { select: { user: { select: { displayName: true, email: true } } } } }, orderBy: { generatedAt: "desc" } },
      reviews: { orderBy: { category: "asc" } },
      assignedMembership: { select: { id: true, user: { select: { displayName: true, email: true } } } },
      identityVerifiedBy: { select: { user: { select: { displayName: true, email: true } } } },
      subjectParty: true,
      clientContact: { include: { portalAccount: { select: { status: true, loginIdentifier: true, createdAt: true, activatedAt: true, lastLoginAt: true } } } },
    } });
    if (!item) throw new NotFoundException("Datenschutzfall wurde nicht gefunden.");
    return item;
  }

  private async assertActiveAssignee(client: Prisma.TransactionClient | PrismaService, tenantId: string, membershipId: string) {
    const membership = await client.tenantMembership.findFirst({ where: { id: membershipId, tenantId, status: MembershipStatus.ACTIVE, deletedAt: null, user: { isActive: true, deletedAt: null } }, select: { id: true } });
    if (!membership) throw new BadRequestException("Der ausgewählte Bearbeiter ist im aktuellen Mandanten nicht aktiv.");
  }

  private async assertCompletable(item: Awaited<ReturnType<DataSubjectRequestsService["find"]>>) {
    if (item.requestType === DataSubjectRequestType.ACCESS && !item.exports.length) throw new ConflictException("Ein Auskunftsersuchen kann erst nach Erstellung eines Exports abgeschlossen werden.");
    if (item.requestType === DataSubjectRequestType.ERASURE && item.reviews.some((review) => !review.finalAction || review.finalAction === DataSubjectDataAction.REVIEW)) throw new ConflictException("Alle Datenkategorien müssen vor Abschluss final entschieden werden.");
    if (item.requestType === DataSubjectRequestType.RECTIFICATION && !item.decision?.trim()) throw new ConflictException("Vor Abschluss ist eine Entscheidung zu dokumentieren.");
    if (item.requestType === DataSubjectRequestType.RESTRICTION) {
      const applied = item.decision === "Verarbeitung eingeschränkt";
      const removed = item.decision === "Verarbeitungseinschränkung aufgehoben";
      if (!item.subjectParty || (!applied && !removed) || (applied && !item.subjectParty.processingRestrictedAt) || (removed && item.subjectParty.processingRestrictedAt)) throw new ConflictException("Die dokumentierte Einschränkungsentscheidung ist noch nicht umgesetzt.");
    }
  }

  private recordStatusChanged(tx: Prisma.TransactionClient, item: Awaited<ReturnType<DataSubjectRequestsService["find"]>>, status: DataSubjectRequestStatus) {
    return this.activity.recordStaffEvent(tx, this.tenant.getStaffContext().tenantMembershipId, { tenantId: item.tenantId, eventType: "DATA_SUBJECT_REQUEST_STATUS_CHANGED", sourceEntityType: "DataSubjectRequest", sourceEntityId: item.id, metadata: { from: item.status, to: status } });
  }

  private async inventory(
    client: Prisma.TransactionClient,
    tenantId: string,
    subjectPartyId: string | null,
    clientContactId: string | null,
  ): Promise<Record<DataSubjectDataCategory, number>> {
    const result = Object.fromEntries(
      categories.map((category) => [category, 0]),
    ) as Record<DataSubjectDataCategory, number>;
    if (clientContactId) {
      result.CLIENT_CONTACT = 1;
      result.PORTAL = await client.portalAccount.count({ where: { tenantId, clientContactId } });
      return result;
    }

    const partyId = subjectPartyId!;
    const caseIds = (
      await client.case.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [{ clientPartyId: partyId }, { debtorPartyId: partyId }],
        },
        select: { id: true },
      })
    ).map(({ id }) => id);
    const caseWhere = { tenantId, caseId: { in: caseIds } };
    const [
      addresses,
      contacts,
      claims,
      ledger,
      payments,
      tasks,
      documents,
      communications,
      portal,
      installmentRequests,
      installmentPlans,
      titles,
      actions,
      activity,
      clientContacts,
    ] = await Promise.all([
      Promise.all([
        client.address.count({ where: { partyId, deletedAt: null } }),
        client.addressResearchRequest.count({ where: { tenantId, partyId } }),
        client.addressResearchResult.count({ where: { tenantId, researchRequest: { partyId } } }),
      ]).then(([addressCount, requestCount, resultCount]) => addressCount + requestCount + resultCount),
      client.contact.count({ where: { partyId, deletedAt: null } }),
      client.claim.count({ where: { tenantId, caseId: { in: caseIds }, deletedAt: null } }),
      client.caseLedgerEntry.count({ where: caseWhere }),
      client.caseLedgerEntry.count({ where: { ...caseWhere, type: "PAYMENT" } }),
      client.caseTask.count({ where: caseWhere }),
      client.caseDocument.count({ where: caseWhere }),
      client.communicationEvent.count({ where: { tenantId, partyId } }),
      client.portalAccount.count({ where: { tenantId, partyId } }),
      client.installmentRequest.count({ where: { tenantId, debtorPartyId: partyId } }),
      client.installmentPlan.count({ where: { tenantId, debtorPartyId: partyId } }),
      client.enforcementTitle.count({ where: caseWhere }),
      client.enforcementAction.count({ where: caseWhere }),
      client.activityEvent.count({
        where: { tenantId, OR: [{ partyId }, { caseId: { in: caseIds } }] },
      }),
      client.clientContact.count({ where: { tenantId, partyId } }),
    ]);
    result.MASTER_DATA = 1;
    result.ADDRESSES = addresses;
    result.CONTACT_DATA = contacts;
    result.CASES = caseIds.length;
    result.CLAIMS = claims;
    result.LEDGER = ledger;
    result.PAYMENTS = payments;
    result.TASKS = tasks;
    result.DOCUMENTS = documents;
    result.COMMUNICATIONS = communications;
    result.PORTAL = portal;
    result.INSTALLMENTS = installmentRequests + installmentPlans;
    result.ENFORCEMENT = titles + actions;
    result.ACTIVITY = activity;
    result.CLIENT_CONTACT = clientContacts;
    result.CREDIT_REPORTING = await client.creditBureauReport.count({ where: { tenantId, partyId } }) + await client.creditBureauReportEvent.count({ where: { tenantId, report: { partyId } } });
    return result;
  }

  private async snapshot(item: Awaited<ReturnType<DataSubjectRequestsService["find"]>>) {
    if (item.clientContact) return { version: 1, generatedAt: new Date().toISOString(), subject: { type: "CLIENT_CONTACT", firstName: item.clientContact.firstName, lastName: item.clientContact.lastName, email: item.clientContact.email, phone: item.clientContact.phone, mobile: item.clientContact.mobile, position: item.clientContact.position, isPrimary: item.clientContact.isPrimary, portalAccount: item.clientContact.portalAccount } };
    const party = item.subjectParty!;
    const cases = await this.prisma.case.findMany({
      where: { tenantId: item.tenantId, OR: [{ clientPartyId: party.id }, { debtorPartyId: party.id }], deletedAt: null },
      select: { id: true, caseNumber: true, status: true, phase: true, priority: true, openedAt: true, closedAt: true, claim: { select: { invoiceNumber: true, invoiceDate: true, dueDate: true, defaultDate: true, principalAmount: true, currency: true, description: true, status: true } } },
      orderBy: { openedAt: "asc" },
    });
    const caseIds = cases.map(({ id }) => id);
    const caseWhere = { tenantId: item.tenantId, caseId: { in: caseIds } };
    const [addresses, addressResearch, creditReporting, contacts, ledger, paymentAllocations, tasks, documents, communications, deskTickets, installmentRequests, installmentPlans, portalAccounts, enforcementTitles, enforcementActions, activity] = await Promise.all([
      this.prisma.address.findMany({ where: { partyId: party.id, deletedAt: null }, select: { street: true, houseNumber: true, postalCode: true, city: true, country: true } }),
      this.prisma.addressResearchRequest.findMany({
        where: { tenantId: item.tenantId, partyId: party.id },
        select: {
          requestedAt: true, completedAt: true, reason: true, provider: true, status: true,
          results: { select: { street: true, houseNumber: true, postalCode: true, city: true, country: true, source: true, sourceDate: true, confidence: true, qualityReason: true, appliedAt: true } },
        },
        orderBy: { requestedAt: "asc" },
      }),
      this.prisma.creditBureauReport.findMany({
        where: { tenantId: item.tenantId, partyId: party.id },
        select: {
          provider: true, status: true, eligibilityStatus: true, eligibilityReason: true,
          reportedAmount: true, currency: true, approvedAt: true, submittedAt: true, settledAt: true, cancelledAt: true,
          case: { select: { caseNumber: true } },
          events: { select: { eventType: true, statusBefore: true, statusAfter: true, reason: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.contact.findMany({ where: { partyId: party.id, deletedAt: null }, select: { type: true, value: true, label: true } }),
      this.prisma.caseLedgerEntry.findMany({ where: caseWhere, select: { caseId: true, side: true, type: true, status: true, amount: true, currency: true, bookingDate: true, valueDate: true, description: true, externalReference: true } }),
      this.prisma.paymentAllocation.findMany({ where: caseWhere, select: { caseId: true, amount: true, policy: true, allocationOrder: true, status: true, createdAt: true, reversedAt: true } }),
      this.prisma.caseTask.findMany({ where: caseWhere, select: { caseId: true, type: true, status: true, priority: true, title: true, description: true, dueAt: true, followUpAt: true, completedAt: true, cancelledAt: true } }),
      this.prisma.caseDocument.findMany({ where: caseWhere, select: { caseId: true, type: true, status: true, portalVisibility: true, filename: true, mimeType: true, renderedSubject: true, renderedBody: true, generatedAt: true, sentAt: true, voidedAt: true } }),
      this.prisma.communicationEvent.findMany({ where: { tenantId: item.tenantId, partyId: party.id }, select: { occurredAt: true, direction: true, channel: true, subject: true, summary: true, attachments: { select: { originalFileName: true, mimeType: true, size: true, sha256: true, createdAt: true } } } }),
      this.prisma.deskTicket.findMany({ where: { tenantId: item.tenantId, partyId: party.id }, select: { number: true, subject: true, status: true, priority: true, category: true, createdAt: true, updatedAt: true, closedAt: true }, orderBy: { createdAt: "asc" } }),
      this.prisma.installmentRequest.findMany({ where: { tenantId: item.tenantId, debtorPartyId: party.id }, select: { caseId: true, status: true, requestedMonthlyAmount: true, preferredStartDate: true, numberOfInstallments: true, debtorMessage: true, submittedAt: true, reviewedAt: true, approvedAt: true, rejectedAt: true } }),
      this.prisma.installmentPlan.findMany({ where: { tenantId: item.tenantId, debtorPartyId: party.id }, select: { caseId: true, source: true, status: true, initialOpenAmount: true, plannedInstallmentAmount: true, startDate: true, numberOfInstallments: true, activatedAt: true, completedAt: true, cancelledAt: true, items: { select: { sequenceNumber: true, dueDate: true, plannedAmount: true, status: true, completedAt: true } } } }),
      this.prisma.portalAccount.findMany({ where: { tenantId: item.tenantId, partyId: party.id }, select: { portalType: true, status: true, loginIdentifier: true, activatedAt: true, lastLoginAt: true, createdAt: true } }),
      this.prisma.enforcementTitle.findMany({ where: caseWhere, select: { caseId: true, type: true, status: true, courtOrAuthority: true, referenceNumber: true, titleDate: true, serviceDate: true, enforceableFrom: true, principalAmount: true, costAmount: true, interestAmount: true, titleTotal: true, notes: true } }),
      this.prisma.enforcementAction.findMany({ where: caseWhere, select: { caseId: true, type: true, status: true, requestedAt: true, completedAt: true, referenceNumber: true, amountAtRequest: true, notes: true } }),
      this.prisma.activityEvent.findMany({ where: { tenantId: item.tenantId, OR: [{ partyId: party.id }, { caseId: { in: caseIds } }] }, select: { eventType: true, title: true, description: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    ]);
    return { version: 1, generatedAt: new Date().toISOString(), subject: { type: "PARTY", displayName: party.displayName, partyType: party.type, addresses, addressResearch, creditReporting, contacts, portalAccounts }, cases, ledger, paymentAllocations, tasks, documents, communications, deskTickets, installmentRequests, installmentPlans, enforcementTitles, enforcementActions, activity, dataOrigin: "nicht strukturiert im System gespeichert", recipients: "nicht strukturiert im System gespeichert" };
  }
}
