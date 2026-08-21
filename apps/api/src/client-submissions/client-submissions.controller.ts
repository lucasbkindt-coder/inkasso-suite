import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";

import { ClientSubmissionsService } from "./client-submissions.service";
import { readCookie } from "../portal-auth/portal-auth.controller";
import { PORTAL_SESSION_COOKIE } from "../portal-auth/portal-auth.service";
import { AcceptClientSubmissionDto } from "./dto/accept-client-submission.dto";
import { CreateClientSubmissionDto } from "./dto/create-client-submission.dto";
import { QueryClientSubmissionsDto } from "./dto/query-client-submissions.dto";
import { RejectClientSubmissionDto } from "./dto/reject-client-submission.dto";

@Controller()
export class ClientSubmissionsController {
  constructor(private readonly service: ClientSubmissionsService) {}

  @Post("portal/client/submissions")
  create(
    @Body() body: CreateClientSubmissionDto,
    @Headers("x-risepay-portal-preview") token?: string,
    @Headers("cookie") cookie?: string,
  ) {
    return this.service.create(body, token, readCookie(cookie, PORTAL_SESSION_COOKIE));
  }

  @Get("portal/client/submissions")
  listPortal(@Headers("x-risepay-portal-preview") token?: string, @Headers("cookie") cookie?: string) {
    return this.service.portalList(token, readCookie(cookie, PORTAL_SESSION_COOKIE));
  }

  @Get("portal/client/submissions/:id")
  onePortal(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-risepay-portal-preview") token?: string,
    @Headers("cookie") cookie?: string,
  ) {
    return this.service.portalOne(id, token, readCookie(cookie, PORTAL_SESSION_COOKIE));
  }

  @Get("client-submissions")
  list(@Query() query: QueryClientSubmissionsDto) {
    return this.service.list(query);
  }

  @Get("client-submissions/:id")
  one(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.one(id);
  }

  @Get("client-submissions/:id/debtor-candidates")
  debtorCandidates(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.debtorCandidates(id);
  }

  @Post("client-submissions/:id/review")
  review(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.review(id);
  }

  @Post("client-submissions/:id/reject")
  reject(@Param("id", ParseUUIDPipe) id: string, @Body() body: RejectClientSubmissionDto) {
    return this.service.reject(id, body);
  }

  @Post("client-submissions/:id/accept")
  accept(@Param("id", ParseUUIDPipe) id: string, @Body() body: AcceptClientSubmissionDto) {
    return this.service.accept(id, body);
  }
}
