import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateTaskDto } from "./dto/create-task.dto";
import { QueryTasksDto } from "./dto/query-tasks.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get() findAll(@Query() query: QueryTasksDto) { return this.tasks.findAll(query); }
  @Get(":id") findOne(@Param("id", ParseUUIDPipe) id: string) { return this.tasks.findOne(id); }
  @Post() create(@Body() dto: CreateTaskDto) { return this.tasks.create(dto); }
  @Patch(":id") update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) { return this.tasks.update(id, dto); }
  @Post(":id/complete") complete(@Param("id", ParseUUIDPipe) id: string) { return this.tasks.complete(id); }
  @Post(":id/reopen") reopen(@Param("id", ParseUUIDPipe) id: string) { return this.tasks.reopen(id); }
  @Post(":id/cancel") cancel(@Param("id", ParseUUIDPipe) id: string) { return this.tasks.cancel(id); }
}
