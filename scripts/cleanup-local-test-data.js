#!/usr/bin/env node

/**
 * One-time, tenant-scoped cleanup for explicitly identified local test tenants.
 *
 * Defaults to a dry run. Run with --execute only after reviewing its output.
 * It intentionally has no heuristic tenant matching: only this explicit list
 * of already identified inactive test tenants can ever be targeted.
 */
const { existsSync, readFileSync } = require("node:fs");
const { unlink } = require("node:fs/promises");
const { join } = require("node:path");
const { PrismaClient } = require("../packages/database/node_modules/@prisma/client");

const EXPLICIT_TEST_TENANT_SLUGS = new Set([
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

function assertLocalDevelopmentDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Safety stop: Testdaten-Cleanup ist mit NODE_ENV=production nicht zulässig.");
  }
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error("Safety stop: DATABASE_URL ist ungültig.");
  }
  const database = url.pathname.replace(/^\//, "").split("/")[0];
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);
  if (!localHosts.has(url.hostname) || !database || /prod(uction)?/i.test(url.hostname) || /prod(uction)?/i.test(database)) {
    throw new Error("Safety stop: DATABASE_URL ist kein eindeutig lokales Entwicklungsziel.");
  }
}

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
  assertLocalDevelopmentDatabase();
  const execute = process.argv.includes("--execute");
  if (process.argv.includes("--apply")) {
    throw new Error("--apply wird nicht unterstützt. Nach dem Dry Run ist --execute erforderlich.");
  }
  const targets = await prisma.tenant.findMany({ where: { slug: { in: [...EXPLICIT_TEST_TENANT_SLUGS] } }, orderBy: { slug: "asc" } });
  const reports = [];
  for (const tenant of targets) {
    if (tenant.isActive || !tenant.deletedAt || !EXPLICIT_TEST_TENANT_SLUGS.has(tenant.slug)) {
      throw new Error(`Safety stop: ${tenant.slug} ist kein eindeutig inaktiver Testtenant.`);
    }
    const membersInActiveTenants = await prisma.tenantMembership.count({
      where: {
        tenantId: tenant.id,
        user: { memberships: { some: { tenant: { isActive: true, deletedAt: null } } } },
      },
    });
    if (membersInActiveTenants) {
      throw new Error(`Safety stop: ${tenant.slug} enthält einen Benutzer mit Membership in einem aktiven Tenant.`);
    }
    reports.push(await tenantReport(tenant));
  }

  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", reports }, null, 2));
  if (!execute) return;

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
      email: { endsWith: ".test" },
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
