#!/usr/bin/env node

/*
 * Controlled repair for documents generated before debtor-facing templates
 * explicitly persisted PortalVisibility.DEBTOR. It is dry-run by default.
 */
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { PrismaClient } = require("../packages/database/node_modules/@prisma/client");

const root = join(__dirname, "..");
if (!process.env.DATABASE_URL && existsSync(join(root, ".env"))) {
  const line = readFileSync(join(root, ".env"), "utf8").split(/\r?\n/).find((value) => value.startsWith("DATABASE_URL="));
  if (line) process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, "");
}

const debtorVisibleTemplateKeys = [
  "payment-request",
  "payment-request-consumer",
  "payment-request-business",
  "payment-reminder",
  "court-dunning-notice",
  "enforcement-notice",
  "title-notification",
  "claim-statement",
  "case-settled",
  "installment-agreement",
  "installment-default-notice",
];

function assertLocalDatabase() {
  if (process.env.NODE_ENV === "production") throw new Error("Safety stop: Nicht in Produktion ausführen.");
  const url = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "::1", "postgres"].includes(url.hostname)) throw new Error("Safety stop: Kein lokales Datenbankziel.");
}

const prisma = new PrismaClient();
async function main() {
  assertLocalDatabase();
  const where = {
    status: "GENERATED",
    portalVisibility: "INTERNAL",
    template: { key: { in: debtorVisibleTemplateKeys } },
  };
  const candidates = await prisma.caseDocument.findMany({
    where,
    select: { id: true, template: { select: { key: true } } },
  });
  console.log(JSON.stringify({ mode: process.argv.includes("--execute") ? "execute" : "dry-run", candidates: candidates.length, templateKeys: [...new Set(candidates.map((item) => item.template?.key).filter(Boolean))] }, null, 2));
  if (!process.argv.includes("--execute")) return;
  const result = await prisma.caseDocument.updateMany({ where, data: { portalVisibility: "DEBTOR" } });
  console.log(JSON.stringify({ updated: result.count }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
