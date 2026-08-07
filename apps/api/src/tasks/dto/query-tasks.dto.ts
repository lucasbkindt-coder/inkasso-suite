import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class QueryTasksDto {
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(TaskType) type?: TaskType;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @IsUUID() assignedMembershipId?: string;
  @IsOptional() @IsDateString() dueFrom?: string;
  @IsOptional() @IsDateString() dueTo?: string;
  @IsOptional() @Transform(({ value }) => value === "true" || value === true) @IsBoolean() overdue = false;
  @IsOptional() @Transform(({ value }) => value === "true" || value === true) @IsBoolean() today = false;
  @IsOptional() @Transform(({ value }) => value === "true" || value === true) @IsBoolean() upcoming = false;
}
