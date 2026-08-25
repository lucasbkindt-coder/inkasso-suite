#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { PrismaClient } = require("../packages/database/node_modules/@prisma/client");

const root = join(__dirname, "..");
if (!process.env.DATABASE_URL) {
  const envPath = join(root, ".env");
  const databaseUrl = existsSync(envPath)
    ? readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .find((line) => line.startsWith("DATABASE_URL="))
        ?.slice("DATABASE_URL=".length)
        .replace(/^['\"]|['\"]$/g, "")
    : undefined;
  if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
}

const storageRoot = join(root, ".data", "documents");
const prisma = new PrismaClient();

async function main() {
  const documents = await prisma.caseDocument.findMany({ select: { id: true, storageKey: true } });
  const files = existsSync(storageRoot) ? readdirSync(storageRoot).filter((name) => name.endsWith(".pdf")) : [];
  const referencedKeys = new Set(documents.map(({ storageKey }) => storageKey));
  const missingFiles = documents.filter(({ storageKey }) => !existsSync(join(storageRoot, storageKey))).map(({ id, storageKey }) => ({ id, storageKey }));
  const orphanedFiles = files.filter((name) => !referencedKeys.has(name));
  console.log(JSON.stringify({ storageRoot, caseDocuments: documents.length, files: files.length, missingFiles, orphanedFiles }, null, 2));
  if (missingFiles.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Storage-Audit fehlgeschlagen.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
