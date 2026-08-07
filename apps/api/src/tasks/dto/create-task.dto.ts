import { TaskPriority, TaskType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateTaskDto {
  @IsOptional() @IsUUID() caseId?: string;
  @IsEnum(TaskType) type!: TaskType;
  @IsOptional() @IsEnum(TaskPriority) priority: TaskPriority = TaskPriority.NORMAL;
  @IsString() @MaxLength(300) title!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() followUpAt?: string;
  @IsOptional() @IsUUID() assignedMembershipId?: string;
}
