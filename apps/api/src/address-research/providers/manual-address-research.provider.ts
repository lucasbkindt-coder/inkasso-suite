import { Injectable } from "@nestjs/common";
import { AddressResearchProviderType } from "@prisma/client";
import type { AddressResearchProvider, ProviderSearchInput } from "./address-research-provider";

@Injectable()
export class ManualAddressResearchProvider implements AddressResearchProvider {
  readonly type = AddressResearchProviderType.MANUAL;
  readonly invokesExternalService = false;
  async search(_input: ProviderSearchInput) { return []; }
}
