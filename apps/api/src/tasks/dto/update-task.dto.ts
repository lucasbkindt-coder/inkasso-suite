import { TaskPriority, TaskType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateTaskDto {
  @IsOptional() @IsEnum(TaskType) type?: TaskType;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() followUpAt?: string;
  @IsOptional() @IsUUID() assignedMembershipId?: string;
}
