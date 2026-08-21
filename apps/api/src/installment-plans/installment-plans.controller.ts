import { Controller, Get, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";

import { readCookie } from "../portal-auth/portal-auth.controller";
import { PORTAL_SESSION_COOKIE } from "../portal-auth/portal-auth.service";
import { InstallmentPlansService } from "./installment-plans.service";

@Controller()
export class InstallmentPlansController {
  constructor(private readonly plans: InstallmentPlansService) {}

  @Get("installment-plans") list() { return this.plans.list(); }
  @Get("installment-plans/:id") one(@Param("id", ParseUUIDPipe) id: string) { return this.plans.one(id); }
  @Post("installment-requests/:id/create-plan") create(@Param("id", ParseUUIDPipe) id: string) { return this.plans.createFromRequest(id); }
  @Post("installment-plans/:id/activate") activate(@Param("id", ParseUUIDPipe) id: string) { return this.plans.activate(id); }
  @Post("installment-plans/:id/cancel") cancel(@Param("id", ParseUUIDPipe) id: string) { return this.plans.cancel(id); }
  @Post("installment-plans/:id/default") default(@Param("id", ParseUUIDPipe) id: string) { return this.plans.default(id); }
  @Get("portal/debtor/cases/:caseId/installment-plan") portal(@Param("caseId", ParseUUIDPipe) caseId: string, @Headers("x-risepay-portal-preview") previewToken?: string, @Headers("cookie") cookie?: string) { return this.plans.portal(caseId, previewToken, readCookie(cookie, PORTAL_SESSION_COOKIE)); }
}
