import type { Prisma } from "@prisma/client";

export function formatDeskTicketNumber(sequenceNumber: number, year: number) {
  return `D-${year}-${String(sequenceNumber).padStart(6, "0")}`;
}

export async function allocateDeskTicketNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year: number,
) {
  const sequence = await tx.deskTicketNumberSequence.upsert({
    where: { tenantId_year: { tenantId, year } },
    create: { tenantId, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return {
    sequenceYear: year,
    sequenceNumber: sequence.lastNumber,
    number: formatDeskTicketNumber(sequence.lastNumber, year),
  };
}
