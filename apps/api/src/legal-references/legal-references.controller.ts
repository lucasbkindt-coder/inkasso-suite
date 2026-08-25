import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";

import { LegalReferencesService } from "./legal-references.service";
import { LegalReferenceSyncService } from "./legal-reference-sync.service";

@Controller("legal-references")
@UseGuards(StaffPermissionGuard)
export class LegalReferencesController {
  constructor(
    private readonly references: LegalReferencesService,
    private readonly sync: LegalReferenceSyncService,
  ) {}
  @Get("status") @RequireStaffPermissions("report:read") status() {
    return this.references.status();
  }
  @Post("sync/base-interest-rate") @RequireStaffPermissions("settings:update") syncBaseInterestRate() {
    return this.sync.syncBaseInterestRates();
  }
  @Post("sync/rvg") @RequireStaffPermissions("settings:update") syncRvg() {
    return this.sync.syncRvg();
  }
  @Get("rvg/versions") @RequireStaffPermissions("report:read") versions() {
    return this.references.rvgVersions();
  }
  @Post("rvg/:id/activate") @RequireStaffPermissions("settings:update") activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.references.activateRvg(id);
  }
  @Post("rvg/:id/reject") @RequireStaffPermissions("settings:update") reject(@Param("id", ParseUUIDPipe) id: string) {
    return this.references.rejectRvg(id);
  }
}
