import { Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";

import { LegalReferencesService } from "./legal-references.service";
import { LegalReferenceSyncService } from "./legal-reference-sync.service";

@Controller("legal-references")
export class LegalReferencesController {
  constructor(
    private readonly references: LegalReferencesService,
    private readonly sync: LegalReferenceSyncService,
  ) {}
  @Get("status") status() {
    return this.references.status();
  }
  @Post("sync/base-interest-rate") syncBaseInterestRate() {
    return this.sync.syncBaseInterestRates();
  }
  @Post("sync/rvg") syncRvg() {
    return this.sync.syncRvg();
  }
  @Get("rvg/versions") versions() {
    return this.references.rvgVersions();
  }
  @Post("rvg/:id/activate") activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.references.activateRvg(id);
  }
  @Post("rvg/:id/reject") reject(@Param("id", ParseUUIDPipe) id: string) {
    return this.references.rejectRvg(id);
  }
}
