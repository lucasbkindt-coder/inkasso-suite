import type { CreditBureauProvider } from "@prisma/client";

export interface CreditBureauProviderAdapter {
  readonly provider: CreditBureauProvider;
  readonly externalSubmissionConfigured: false;
}

export const configuredCreditBureauProviders: CreditBureauProviderAdapter[] = [
  { provider: "MANUAL", externalSubmissionConfigured: false },
  { provider: "MOCK", externalSubmissionConfigured: false },
];
