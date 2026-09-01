import { DeskTicketPriority, DeskTicketStatus } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class QueryDeskTicketsDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(DeskTicketStatus)
  status?: DeskTicketStatus;

  @IsOptional()
  @IsEnum(DeskTicketPriority)
  priority?: DeskTicketPriority;

  @IsOptional()
  @IsUUID()
  assigneeMembershipId?: string;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  mine = false;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  unassigned = false;
}

export class SearchDeskContextDto {
  @IsString()
  @MaxLength(200)
  search = "";
}
