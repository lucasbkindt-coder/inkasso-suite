#!/usr/bin/env node

/**
 * One-time, tenant-scoped cleanup for explicitly identified local test tenants.
 *
 * Defaults to a dry run. Run with --apply only after reviewing its output.
 * It intentionally has no heuristic tenant matching and never targets a tenant
 * containing the protected local staff user kindt@payveo.de.
 */
const { existsSync, readFileSync } = require("node:fs");
const { unlink } = require("node:fs/promises");
const { join } = require("node:path");
const { PrismaClient } = require("../packages/database/node_modules/@prisma/client");

const PROTECTED_USER_EMAIL = "kindt@payveo.de";
const TARGET_SLUGS = new Set([
  "audit-temp-20260825132332",
  "audit-temp-1787664247552",
  "audit-isolation-1787664314167",
  "legal-acceptance-20260825",
  "legal-acceptance-20260825-v2",
]);

if (!process.env.DATABASE_URL) {
  const envPath = join(__dirname, "..", ".env");
  const databaseUrl = existsSync(envPath)
    ? readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .find((line) => line.startsWith("DATABASE_URL="))
        ?.slice("DATABASE_URL=".length)
        .replace(/^['\"]|['\"]$/g, "")
    : undefined;
  if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
}

const prisma = new PrismaClient();
const documentStorageRoot = join(__dirname, "..", ".data", "documents");

const countModels = [
  "party",
  "address",
  "contact",
  "case",
  "claim",
  "caseLedgerEntry",
  "caseCostCalculation",
  "paymentAllocation",
  "caseTask",
  "caseDocument",
  "documentDelivery",
  "installmentRequest",
  "installmentPlan",
  "installmentPlanItem",
  "portalAccount",
  "clientSubmission",
  "activityEvent",
  "enforcementTitle",
  "enforcementAction",
  "debtor",
  "documentTemplate",
  "tenantMembership",
  "staffSession",
  "role",
  "team",
  "caseNumberSequence",
  "tenantDocumentSettings",
];

function tenantWhere(model, tenantId) {
  if (["address", "contact"].includes(model)) return { party: { tenantId } };
  if (model === "installmentPlanItem") return { plan: { tenantId } };
  return { tenantId };
}

async function tenantReport(tenant) {
  const counts = {};
  for (const model of countModels) {
    counts[model] = await prisma[model].count({ where: tenantWhere(model, tenant.id) });
  }
  const storageKeys = await prisma.caseDocument.findMany({
    where: { tenantId: tenant.id },
    select: { storageKey: true },
  });
  const existingFiles = storageKeys.filter(({ storageKey }) => existsSync(join(documentStorageRoot, storageKey))).length;
  return { tenant, counts, storageKeys: storageKeys.map(({ storageKey }) => storageKey), existingFiles };
}

async function deleteTenantData(tenantId) {
  await prisma.$transaction(async (tx) => {
    // References to memberships, portal accounts, cases and parties are removed first.
    await tx.activityEvent.deleteMany({ where: { tenantId } });
    await tx.documentDelivery.deleteMany({ where: { tenantId } });
    await tx.paymentAllocation.deleteMany({ where: { tenantId } });
    await tx.enforcementAction.deleteMany({ where: { tenantId } });
    await tx.enforcementTitle.deleteMany({ where: { tenantId } });
    await tx.installmentPlanItem.deleteMany({ where: { tenantId } });
    await tx.installmentPlan.deleteMany({ where: { tenantId } });
    await tx.installmentRequest.deleteMany({ where: { tenantId } });
    await tx.caseTask.deleteMany({ where: { tenantId } });
    await tx.caseDocument.deleteMany({ where: { tenantId } });
    await tx.clientSubmission.deleteMany({ where: { tenantId } });
    await tx.portalSession.deleteMany({ where: { portalAccount: { tenantId } } });
    await tx.portalActivation.deleteMany({ where: { portalAccount: { tenantId } } });
    await tx.portalAccount.deleteMany({ where: { tenantId } });
    await tx.caseLedgerEntry.deleteMany({ where: { tenantId } });
    await tx.caseCostCalculation.deleteMany({ where: { tenantId } });
    await tx.claim.deleteMany({ where: { tenantId } });
    await tx.case.deleteMany({ where: { tenantId } });
    await tx.address.deleteMany({ where: { party: { tenantId } } });
    await tx.contact.deleteMany({ where: { party: { tenantId } } });
    await tx.partyRole.deleteMany({ where: { party: { tenantId } } });
    await tx.person.deleteMany({ where: { party: { tenantId } } });
    await tx.company.deleteMany({ where: { party: { tenantId } } });
    await tx.party.deleteMany({ where: { tenantId } });
    await tx.debtor.deleteMany({ where: { tenantId } });
    await tx.caseNumberSequence.deleteMany({ where: { tenantId } });
    await tx.staffSession.deleteMany({ where: { tenantId } });
    await tx.teamMembershipRole.deleteMany({ where: { teamMembership: { membership: { tenantId } } } });
    await tx.teamMembership.deleteMany({ where: { membership: { tenantId } } });
    await tx.membershipRole.deleteMany({ where: { membership: { tenantId } } });
    await tx.team.deleteMany({ where: { tenantId } });
    await tx.tenantMembership.deleteMany({ where: { tenantId } });
    await tx.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await tx.role.deleteMany({ where: { tenantId } });
    await tx.documentTemplate.deleteMany({ where: { tenantId } });
    await tx.tenantDocumentSettings.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const targets = await prisma.tenant.findMany({ where: { slug: { in: [...TARGET_SLUGS] } }, orderBy: { slug: "asc" } });
  const reports = [];
  for (const tenant of targets) {
    const containsProtectedUser = await prisma.tenantMembership.count({
      where: { tenantId: tenant.id, user: { email: PROTECTED_USER_EMAIL } },
    });
    if (containsProtectedUser) throw new Error(`Safety stop: protected user belongs to ${tenant.slug}.`);
    reports.push(await tenantReport(tenant));
  }

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", protectedUser: PROTECTED_USER_EMAIL, reports }, null, 2));
  if (!apply) return;

  const formerMemberUserIds = new Set();
  for (const { tenant } of reports) {
    const members = await prisma.tenantMembership.findMany({ where: { tenantId: tenant.id }, select: { userId: true } });
    members.forEach(({ userId }) => formerMemberUserIds.add(userId));
    await deleteTenantData(tenant.id);
  }

  const deletableUsers = await prisma.user.findMany({
    where: {
      id: { in: [...formerMemberUserIds] },
      memberships: { none: {} },
      staffSessions: { none: {} },
      AND: [{ email: { not: PROTECTED_USER_EMAIL } }, { email: { endsWith: ".test" } }],
    },
    select: { id: true, email: true },
  });
  if (deletableUsers.length) await prisma.user.deleteMany({ where: { id: { in: deletableUsers.map(({ id }) => id) } } });

  const storageKeys = reports.flatMap((report) => report.storageKeys);
  let removedFiles = 0;
  for (const key of storageKeys) {
    const path = join(documentStorageRoot, key);
    if (existsSync(path)) {
      await unlink(path);
      removedFiles += 1;
    }
  }
  console.log(JSON.stringify({ deletedTenants: reports.map(({ tenant }) => tenant.slug), deletedUsers: deletableUsers.map(({ email }) => email), removedFiles }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
