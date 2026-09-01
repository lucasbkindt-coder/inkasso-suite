import { Injectable } from "@nestjs/common";
import { AddressResearchProviderType } from "@prisma/client";
import type { AddressResearchProvider, ProviderSearchInput } from "./address-research-provider";

@Injectable()
export class MockAddressResearchProvider implements AddressResearchProvider {
  readonly type = AddressResearchProviderType.MOCK;
  readonly invokesExternalService = true;
  async search(input: ProviderSearchInput) {
    if (!input.originalAddress) return [];
    return [{ ...input.originalAddress, houseNumber: input.originalAddress.houseNumber ?? undefined, source: "MOCK", confidence: "MEDIUM" as const, qualityReason: "Technischer Mock-Treffer ohne externe Abfrage" }];
  }
}
