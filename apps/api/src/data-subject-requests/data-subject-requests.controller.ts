import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { CreateDataSubjectRequestDto, ReviewDataDto, UpdateDataSubjectRequestDto, VerifyIdentityDto } from "./dto";
import { DataSubjectRequestsService } from "./data-subject-requests.service";
@Controller("data-subject-requests") @UseGuards(StaffPermissionGuard)
export class DataSubjectRequestsController {
  constructor(private readonly service: DataSubjectRequestsService) {}
  @Get() @RequireStaffPermissions("privacy:read") list(){return this.service.list();}
  @Get("options") @RequireStaffPermissions("privacy:manage") options(){return this.service.options();}
  @Get(":id") @RequireStaffPermissions("privacy:read") get(@Param("id",ParseUUIDPipe) id:string){return this.service.get(id);}
  @Post() @RequireStaffPermissions("privacy:manage") create(@Body() dto:CreateDataSubjectRequestDto){return this.service.create(dto);}
  @Patch(":id") @RequireStaffPermissions("privacy:manage") update(@Param("id",ParseUUIDPipe) id:string,@Body() dto:UpdateDataSubjectRequestDto){return this.service.update(id,dto);}
  @Post(":id/identity-verification") @RequireStaffPermissions("privacy:manage") verify(@Param("id",ParseUUIDPipe) id:string,@Body() dto:VerifyIdentityDto){return this.service.verify(id,dto);}
  @Post(":id/access-exports") @RequireStaffPermissions("privacy:export") export(@Param("id",ParseUUIDPipe) id:string){return this.service.export(id);}
  @Patch(":id/reviews/:category") @RequireStaffPermissions("privacy:manage") review(@Param("id",ParseUUIDPipe) id:string,@Param("category") category:string,@Body() dto:ReviewDataDto){return this.service.review(id,category,dto);}
  @Post(":id/restriction/apply") @RequireStaffPermissions("privacy:manage") applyRestriction(@Param("id",ParseUUIDPipe) id:string,@Body() dto:VerifyIdentityDto){return this.service.applyRestriction(id,dto.note);}
  @Post(":id/restriction/remove") @RequireStaffPermissions("privacy:manage") removeRestriction(@Param("id",ParseUUIDPipe) id:string,@Body() dto:VerifyIdentityDto){return this.service.removeRestriction(id,dto.note);}
  @Get(":id/access-exports/:exportId/download") @RequireStaffPermissions("privacy:export") async download(@Param("id",ParseUUIDPipe) id:string,@Param("exportId",ParseUUIDPipe) exportId:string,@Res() response:{setHeader(name:string,value:string):void;send(value:string):void}){const value=await this.service.download(id,exportId);response.setHeader("Content-Type","application/json; charset=utf-8");response.setHeader("Content-Disposition",`attachment; filename=\"${value.filename}\"`);response.send(value.content);}
}
