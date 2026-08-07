import type { Prisma } from "@prisma/client";

export function formatCaseNumber(sequenceNumber: number, year: number) {
  return `${String(sequenceNumber).padStart(7, "0")}/${year}`;
}

/**
 * Allocates a tenant/year-local case number. It must be called inside the
 * enclosing case creation transaction so the sequence increment and Case
 * insert are committed atomically.
 */
export async function allocateCaseNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year: number,
) {
  const sequence = await tx.caseNumberSequence.upsert({
    where: { tenantId_year: { tenantId, year } },
    create: { tenantId, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return {
    sequenceNumber: sequence.lastNumber,
    sequenceYear: year,
    caseNumber: formatCaseNumber(sequence.lastNumber, year),
  };
}
