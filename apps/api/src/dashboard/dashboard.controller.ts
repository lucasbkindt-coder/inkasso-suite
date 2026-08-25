import { Controller, Get, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(StaffPermissionGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  @RequireStaffPermissions("report:read")
  getSummary() {
    return this.dashboard.getSummary();
  }
}
