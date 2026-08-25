import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireStaffPermissions } from "../staff-auth/staff-permission.decorator";
import { StaffPermissionGuard } from "../staff-auth/staff-permission.guard";
import { CreateTaskDto } from "./dto/create-task.dto";
import { QueryTasksDto } from "./dto/query-tasks.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@Controller("tasks")
@UseGuards(StaffPermissionGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get() @RequireStaffPermissions("case:read") findAll(@Query() query: QueryTasksDto) { return this.tasks.findAll(query); }
  @Get(":id") @RequireStaffPermissions("case:read") findOne(@Param("id", ParseUUIDPipe) id: string) { return this.tasks.findOne(id); }
  @Post() @RequireStaffPermissions("case:update") create(@Body() dto: CreateTaskDto) { return this.tasks.create(dto); }
  @Patch(":id") @RequireStaffPermissions("case:update") update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) { return this.tasks.update(id, dto); }
  @Post(":id/complete") @RequireStaffPermissions("case:update") complete(@Param("id", ParseUUIDPipe) id: string) { return this.tasks.complete(id); }
  @Post(":id/reopen") @RequireStaffPermissions("case:update") reopen(@Param("id", ParseUUIDPipe) id: string) { return this.tasks.reopen(id); }
  @Post(":id/cancel") @RequireStaffPermissions("case:update") cancel(@Param("id", ParseUUIDPipe) id: string) { return this.tasks.cancel(id); }
}
