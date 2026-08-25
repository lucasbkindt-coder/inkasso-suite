import { Inject, Injectable, Scope, UnauthorizedException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";

export type StaffRequestContext = {
  userId: string;
  tenantId: string;
  tenantMembershipId: string;
  permissions: string[];
  roles: string[];
  passwordMustChange: boolean;
};

type StaffRequest = { staffAuth?: StaffRequestContext };

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REQUEST) private readonly request: StaffRequest,
  ) {}

  async getTenantId() {
    const tenantId = this.request.staffAuth?.tenantId;
    if (!tenantId) throw new UnauthorizedException("Mitarbeiter-Anmeldung erforderlich.");
    return tenantId;
  }

  getStaffContext() {
    const context = this.request.staffAuth;
    if (!context) throw new UnauthorizedException("Mitarbeiter-Anmeldung erforderlich.");
    return context;
  }
}
