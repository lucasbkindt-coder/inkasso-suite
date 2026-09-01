import { ConflictException, Injectable } from "@nestjs/common";
import type { AddressResearchProviderType } from "@prisma/client";
import type { AddressResearchProvider, ProviderSearchInput } from "./address-research-provider";
import { ManualAddressResearchProvider } from "./manual-address-research.provider";
import { MockAddressResearchProvider } from "./mock-address-research.provider";

@Injectable()
export class AddressResearchProviderService {
  private readonly providers: Map<AddressResearchProviderType, AddressResearchProvider>;
  constructor(manual: ManualAddressResearchProvider, mock: MockAddressResearchProvider) {
    this.providers = new Map<AddressResearchProviderType, AddressResearchProvider>([
      [manual.type, manual],
      [mock.type, mock],
    ]);
  }
  async search(type: AddressResearchProviderType, input: ProviderSearchInput) {
    const provider = this.providers.get(type);
    if (!provider) throw new ConflictException("Der Rechercheanbieter ist nicht verfügbar.");
    if (provider.invokesExternalService && input.processingRestricted) {
      throw new ConflictException("Bei eingeschränkter Verarbeitung darf keine automatisierte Anbieterabfrage gestartet werden.");
    }
    return provider.search(input);
  }
}
