import type { Case } from "@/types/case";

export const mockCases: Case[] = [
  {
    id: "1",
    fileNumber: "AKT-2026-000001",

    status: "aussergerichtlich",

    principalClaim: 4250,

    interest: 375.6,

    costs: 200,

    totalClaim: 4825.6,

    openAmount: 4075.6,

    createdAt: "2026-07-18",

    updatedAt: "2026-08-08",

    dueDate: "2026-08-15",

    clerk: "Lucas Kindt",

    client: {
      id: "1",
      name: "RisePay GmbH",
      email: "info@risepay.de"
    },

    debtor: {
      id: "1",
      firstName: "Max",
      lastName: "Mustermann",
      street: "Musterstraße 12",
      zip: "77652",
      city: "Offenburg",
      email: "max@example.de"
    },

    documents: [],

    payments: [],

    tasks: [],

    notes: []
  }
];

export function getMockCases() {
  return mockCases;
}

export function getMockCase(id: string) {
  return mockCases.find(
    c => c.id === id || c.fileNumber === id
  );
}