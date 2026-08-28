#!/usr/bin/env node

/*
 * One-time ownership cleanup for the single local development workspace.
 * It is dry-run by default. Records without a technically provable creator are
 * REVIEW, never deletion candidates.
 */
const { existsSync, readFileSync } = require("node:fs");
const { unlink } = require("node:fs/promises");
const { join } = require("node:path");
const { PrismaClient } = require("../packages/database/node_modules/@prisma/client");

const root = join(__dirname, "..");
if (!process.env.DATABASE_URL) {
  const envPath = join(root, ".env");
  const value = existsSync(envPath)
    ? readFileSync(envPath, "utf8").split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, "")
    : undefined;
  if (value) process.env.DATABASE_URL = value;
}

function assertLocalDevelopmentDatabase() {
  if (process.env.NODE_ENV === "production") throw new Error("Safety stop: Ownership-Cleanup ist mit NODE_ENV=production nicht zulässig.");
  let url;
  try { url = new URL(process.env.DATABASE_URL); } catch { throw new Error("Safety stop: DATABASE_URL ist ungültig."); }
  const database = url.pathname.replace(/^\//, "").split("/")[0];
  if (!new Set(["localhost", "127.0.0.1", "::1", "postgres"]).has(url.hostname) || !database || /prod(uction)?/i.test(url.hostname) || /prod(uction)?/i.test(database)) {
    throw new Error("Safety stop: DATABASE_URL ist kein eindeutig lokales Entwicklungsziel.");
  }
}

const prisma = new PrismaClient();
const storageRoot = join(root, ".data", "documents");

function ownerIndex(events, eventType, sourceEntityType) {
  const result = new Map();
  for (const event of events) {
    if (event.eventType !== eventType || event.sourceEntityType !== sourceEntityType || !event.sourceEntityId || !event.actorMembershipId) continue;
    const values = result.get(event.sourceEntityId) ?? new Set();
    values.add(event.actorMembershipId);
    result.set(event.sourceEntityId, values);
  }
  return result;
}

function ownershipFromEvents(id, creators, currentMembershipId, kind) {
  const values = creators.get(id) ?? new Set();
  if (values.size !== 1) return { kind: "REVIEW", reason: values.size ? `${kind}-Erstellung hat mehrere Creator-Zuordnungen.` : `Kein belastbares ${kind}-Erstellereignis.` };
  return values.has(currentMembershipId)
    ? { kind: "OWNED", reason: null }
    : { kind: "FOREIGN", reason: null };
}

function countBy(items, field = "kind") {
  return items.reduce((counts, item) => ({ ...counts, [item[field]]: (counts[item[field]] ?? 0) + 1 }), { OWNED: 0, FOREIGN: 0, DEPENDENT: 0, REVIEW: 0 });
}

async function loadContext() {
  const tenants = await prisma.tenant.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true } });
  if (tenants.length !== 1) throw new Error("Safety stop: Es muss genau ein aktiver lokaler Tenant vorhanden sein.");
  const tenant = tenants[0];
  const sessions = await prisma.staffSession.findMany({
    where: { tenantId: tenant.id, revokedAt: null, expiresAt: { gt: new Date() }, membership: { deletedAt: null, status: "ACTIVE" } },
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    select: { userId: true, tenantMembershipId: true, user: { select: { email: true } } },
  });
  const memberships = new Set(sessions.map((session) => session.tenantMembershipId));
  if (memberships.size !== 1 || !sessions.length) throw new Error("Safety stop: Der aktuelle Staff-Kontext ist nicht eindeutig durch aktive Sessions bestimmbar.");
  return { tenant, userId: sessions[0].userId, membershipId: sessions[0].tenantMembershipId, userEmail: sessions[0].user.email };
}

async function dryRun() {
  const context = await loadContext();
  const tenantId = context.tenant.id;
  const [events, cases, parties, ledgerEntries, documents, tasks, installmentRequests, installmentPlans, titles, actions, clientSubmissions, portalAccounts, clientContacts, communications] = await Promise.all([
    prisma.activityEvent.findMany({ where: { tenantId }, select: { eventType: true, sourceEntityType: true, sourceEntityId: true, caseId: true, partyId: true, actorMembershipId: true } }),
    prisma.case.findMany({ where: { tenantId }, select: { id: true, clientPartyId: true, debtorPartyId: true } }),
    prisma.party.findMany({ where: { tenantId }, select: { id: true, type: true } }),
    prisma.caseLedgerEntry.findMany({ where: { tenantId }, select: { id: true, caseId: true, createdByMembershipId: true, type: true } }),
    prisma.caseDocument.findMany({ where: { tenantId }, select: { id: true, caseId: true, createdByMembershipId: true, storageKey: true } }),
    prisma.caseTask.findMany({ where: { tenantId }, select: { id: true, caseId: true, createdByMembershipId: true } }),
    prisma.installmentRequest.findMany({ where: { tenantId }, select: { id: true, caseId: true, reviewedByMembershipId: true } }),
    prisma.installmentPlan.findMany({ where: { tenantId }, select: { id: true, caseId: true, createdByMembershipId: true, cancelledByMembershipId: true } }),
    prisma.enforcementTitle.findMany({ where: { tenantId }, select: { id: true, caseId: true, createdByMembershipId: true } }),
    prisma.enforcementAction.findMany({ where: { tenantId }, select: { id: true, caseId: true, createdByMembershipId: true } }),
    prisma.clientSubmission.findMany({ where: { tenantId }, select: { id: true, clientPartyId: true, acceptedCaseId: true, reviewedByMembershipId: true } }),
    prisma.portalAccount.findMany({ where: { tenantId }, select: { id: true, partyId: true } }),
    prisma.clientContact.findMany({ where: { tenantId }, select: { id: true, partyId: true } }),
    prisma.communicationEvent.findMany({ where: { tenantId }, select: { id: true, caseId: true, partyId: true } }),
  ]);

  const caseCreators = ownerIndex(events, "CASE_CREATED", "Case");
  const partyCreators = ownerIndex(events, "PARTY_CREATED", "Party");
  const documentCreators = ownerIndex(events, "DOCUMENT_CREATED", "CaseDocument");
  const taskCreators = ownerIndex(events, "TASK_CREATED", "CaseTask");

  const caseClassifications = cases.map((caseRecord) => {
    const result = ownershipFromEvents(caseRecord.id, caseCreators, context.membershipId, "Case");
    if (result.kind !== "FOREIGN") return { id: caseRecord.id, ...result };
    const ownWork = [
      ...ledgerEntries.filter((entry) => entry.caseId === caseRecord.id && entry.createdByMembershipId === context.membershipId),
      ...documents.filter((document) => document.caseId === caseRecord.id && (document.createdByMembershipId === context.membershipId || (documentCreators.get(document.id) ?? new Set()).has(context.membershipId))),
      ...tasks.filter((task) => task.caseId === caseRecord.id && (task.createdByMembershipId === context.membershipId || (taskCreators.get(task.id) ?? new Set()).has(context.membershipId))),
      ...installmentRequests.filter((request) => request.caseId === caseRecord.id && request.reviewedByMembershipId === context.membershipId),
      ...installmentPlans.filter((plan) => plan.caseId === caseRecord.id && (plan.createdByMembershipId === context.membershipId || plan.cancelledByMembershipId === context.membershipId)),
      ...titles.filter((title) => title.caseId === caseRecord.id && title.createdByMembershipId === context.membershipId),
      ...actions.filter((action) => action.caseId === caseRecord.id && action.createdByMembershipId === context.membershipId),
      ...clientSubmissions.filter((submission) => submission.acceptedCaseId === caseRecord.id && submission.reviewedByMembershipId === context.membershipId),
      ...events.filter((event) => event.caseId === caseRecord.id && event.actorMembershipId === context.membershipId),
    ];
    return ownWork.length ? { id: caseRecord.id, kind: "REVIEW", reason: "FOREIGN-Akte enthält technisch nachweisbare Bearbeitung des aktuellen Staff-Kontexts." } : { id: caseRecord.id, ...result };
  });
  const retainedCaseIds = new Set(caseClassifications.filter((item) => item.kind !== "FOREIGN").map((item) => item.id));
  const retainedPartyIds = new Set(cases.filter((item) => retainedCaseIds.has(item.id)).flatMap((item) => [item.clientPartyId, item.debtorPartyId]));

  const partyClassifications = parties.map((party) => {
    const base = ownershipFromEvents(party.id, partyCreators, context.membershipId, "Party");
    if (retainedPartyIds.has(party.id) && base.kind !== "OWNED") return { id: party.id, type: party.type, kind: "DEPENDENT", reason: "Von einer erhaltenen Akte referenziert." };
    if (base.kind === "FOREIGN" && events.some((event) => event.partyId === party.id && event.actorMembershipId === context.membershipId)) return { id: party.id, type: party.type, kind: "REVIEW", reason: "FOREIGN-Party enthält technisch nachweisbare Bearbeitung des aktuellen Staff-Kontexts." };
    if (base.kind === "FOREIGN" && clientSubmissions.some((submission) => submission.clientPartyId === party.id)) return { id: party.id, type: party.type, kind: "REVIEW", reason: "Party ist mit Submission ohne eindeutige Creator-Herkunft verknüpft." };
    return { id: party.id, type: party.type, ...base };
  });
  const deleteCaseIds = caseClassifications.filter((item) => item.kind === "FOREIGN").map((item) => item.id);
  const deletePartyIds = partyClassifications.filter((item) => item.kind === "FOREIGN").map((item) => item.id);
  const deleteDocuments = documents.filter((document) => deleteCaseIds.includes(document.caseId));
  const deleteCommunicationIds = communications
    .filter((communication) => deleteCaseIds.includes(communication.caseId) || deletePartyIds.includes(communication.partyId))
    .map((communication) => communication.id);
  const deleteCommunicationAttachments = await prisma.communicationAttachment.findMany({
    where: { communicationId: { in: deleteCommunicationIds } },
    select: { storageKey: true },
  });

  const review = [
    ...caseClassifications.filter((item) => item.kind === "REVIEW").map(({ id, reason }) => ({ id, type: "Case", reason })),
    ...partyClassifications.filter((item) => item.kind === "REVIEW").map(({ id, reason }) => ({ id, type: "Party", reason })),
  ];
  const deleteCounts = {
    cases: deleteCaseIds.length,
    parties: deletePartyIds.length,
    claims: await prisma.claim.count({ where: { caseId: { in: deleteCaseIds } } }),
    ledgerEntries: await prisma.caseLedgerEntry.count({ where: { caseId: { in: deleteCaseIds } } }),
    payments: await prisma.caseLedgerEntry.count({ where: { caseId: { in: deleteCaseIds }, type: "PAYMENT" } }),
    paymentAllocations: await prisma.paymentAllocation.count({ where: { caseId: { in: deleteCaseIds } } }),
    tasks: await prisma.caseTask.count({ where: { caseId: { in: deleteCaseIds } } }),
    documents: deleteDocuments.length,
    communications: deleteCommunicationIds.length,
    communicationAttachments: deleteCommunicationAttachments.length,
    installmentRequests: await prisma.installmentRequest.count({ where: { caseId: { in: deleteCaseIds } } }),
    installmentPlans: await prisma.installmentPlan.count({ where: { caseId: { in: deleteCaseIds } } }),
    titles: await prisma.enforcementTitle.count({ where: { caseId: { in: deleteCaseIds } } }),
    enforcementActions: await prisma.enforcementAction.count({ where: { caseId: { in: deleteCaseIds } } }),
    activities: await prisma.activityEvent.count({ where: { tenantId, OR: [{ caseId: { in: deleteCaseIds } }, { partyId: { in: deletePartyIds } }] } }),
    portalAccounts: await prisma.portalAccount.count({ where: { partyId: { in: deletePartyIds } } }),
    clientContacts: clientContacts.filter((contact) => deletePartyIds.includes(contact.partyId)).length,
    pdfs: [...deleteDocuments, ...deleteCommunicationAttachments].filter((document) => existsSync(join(storageRoot, document.storageKey))).length,
  };
  return { context, caseClassifications, partyClassifications, deleteCaseIds, deletePartyIds, deleteDocuments, deleteCommunicationIds, deleteCommunicationAttachments, deleteCounts, review, summary: { cases: countBy(caseClassifications), parties: countBy(partyClassifications) } };
}

async function execute(plan) {
  if (!plan.deleteCaseIds.length && !plan.deletePartyIds.length) return { deleted: plan.deleteCounts, removedPdfs: 0 };
  await prisma.$transaction(async (tx) => {
    const caseFilter = { in: plan.deleteCaseIds };
    const partyFilter = { in: plan.deletePartyIds };
    await tx.activityEvent.deleteMany({ where: { tenantId: plan.context.tenant.id, OR: [{ caseId: caseFilter }, { partyId: partyFilter }] } });
    await tx.communicationAttachment.deleteMany({ where: { communicationId: { in: plan.deleteCommunicationIds } } });
    await tx.communicationEvent.deleteMany({ where: { id: { in: plan.deleteCommunicationIds } } });
    await tx.documentDelivery.deleteMany({ where: { caseId: caseFilter } });
    await tx.paymentAllocation.deleteMany({ where: { caseId: caseFilter } });
    await tx.enforcementAction.deleteMany({ where: { caseId: caseFilter } });
    await tx.enforcementTitle.deleteMany({ where: { caseId: caseFilter } });
    await tx.installmentPlanItem.deleteMany({ where: { plan: { caseId: caseFilter } } });
    await tx.installmentPlan.deleteMany({ where: { caseId: caseFilter } });
    await tx.installmentRequest.deleteMany({ where: { caseId: caseFilter } });
    await tx.caseTask.deleteMany({ where: { caseId: caseFilter } });
    await tx.caseDocument.deleteMany({ where: { caseId: caseFilter } });
    await tx.clientSubmission.deleteMany({ where: { acceptedCaseId: caseFilter } });
    await tx.caseLedgerEntry.deleteMany({ where: { caseId: caseFilter } });
    await tx.caseCostCalculation.deleteMany({ where: { caseId: caseFilter } });
    await tx.claim.deleteMany({ where: { caseId: caseFilter } });
    await tx.case.deleteMany({ where: { id: caseFilter } });
    await tx.portalSession.deleteMany({ where: { portalAccount: { partyId: partyFilter } } });
    await tx.portalActivation.deleteMany({ where: { portalAccount: { partyId: partyFilter } } });
    await tx.portalAccount.deleteMany({ where: { partyId: partyFilter } });
    await tx.clientContact.deleteMany({ where: { partyId: partyFilter } });
    await tx.address.deleteMany({ where: { partyId: partyFilter } });
    await tx.contact.deleteMany({ where: { partyId: partyFilter } });
    await tx.partyRole.deleteMany({ where: { partyId: partyFilter } });
    await tx.person.deleteMany({ where: { partyId: partyFilter } });
    await tx.company.deleteMany({ where: { partyId: partyFilter } });
    await tx.party.deleteMany({ where: { id: partyFilter } });
  });
  let removedPdfs = 0;
  for (const document of [...plan.deleteDocuments, ...plan.deleteCommunicationAttachments]) {
    const references = (await prisma.caseDocument.count({ where: { storageKey: document.storageKey } }))
      + (await prisma.communicationAttachment.count({ where: { storageKey: document.storageKey } }));
    const path = join(storageRoot, document.storageKey);
    if (!references && existsSync(path)) {
      await unlink(path);
      removedPdfs += 1;
    }
  }
  return { deleted: plan.deleteCounts, removedPdfs };
}

async function main() {
  assertLocalDevelopmentDatabase();
  const executeRequested = process.argv.includes("--execute");
  const plan = await dryRun();
  console.log(JSON.stringify({ mode: executeRequested ? "execute" : "dry-run", context: plan.context, summary: plan.summary, deleteCounts: plan.deleteCounts, review: plan.review }, null, 2));
  if (!executeRequested) return;
  const result = await execute(plan);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
