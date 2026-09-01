import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { AddressResearchController } from "./address-research.controller";
import { AddressResearchService } from "./address-research.service";
import { AddressResearchProviderService } from "./providers/address-research-provider.service";
import { ManualAddressResearchProvider } from "./providers/manual-address-research.provider";
import { MockAddressResearchProvider } from "./providers/mock-address-research.provider";

@Module({
  imports: [CoreModule],
  controllers: [AddressResearchController],
  providers: [AddressResearchService, AddressResearchProviderService, ManualAddressResearchProvider, MockAddressResearchProvider],
})
export class AddressResearchModule {}
