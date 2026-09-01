import { Module } from "@nestjs/common";

import { CoreModule } from "../../core/core.module";
import { ZOHO_DESK_FETCH, ZohoDeskClient } from "./zoho-desk.client";
import { ZohoDeskConfigService } from "./zoho-desk.config";
import { ZohoDeskController } from "./zoho-desk.controller";
import { ZohoDeskMatchingService } from "./zoho-desk-matching.service";
import { ZohoDeskService } from "./zoho-desk.service";

@Module({
  imports: [CoreModule],
  controllers: [ZohoDeskController],
  providers: [
    ZohoDeskConfigService,
    ZohoDeskClient,
    ZohoDeskService,
    ZohoDeskMatchingService,
    { provide: ZOHO_DESK_FETCH, useValue: globalThis.fetch.bind(globalThis) },
  ],
  exports: [ZohoDeskClient, ZohoDeskMatchingService],
})
export class ZohoDeskModule {}
