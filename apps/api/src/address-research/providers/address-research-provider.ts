import type { AddressResearchProviderType } from "@prisma/client";

export type ProviderSearchInput = {
  partyId: string;
  processingRestricted: boolean;
  originalAddress: {
    street: string;
    houseNumber: string | null;
    postalCode: string;
    city: string;
    country: string;
  } | null;
};

export type NormalizedProviderResult = {
  street: string;
  houseNumber?: string;
  postalCode: string;
  city: string;
  country: string;
  source: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  qualityReason?: string;
};

export interface AddressResearchProvider {
  readonly type: AddressResearchProviderType;
  readonly invokesExternalService: boolean;
  search(input: ProviderSearchInput): Promise<NormalizedProviderResult[]>;
}
