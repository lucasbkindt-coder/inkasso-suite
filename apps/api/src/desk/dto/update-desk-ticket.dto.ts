import { DeskTicketPriority, DeskTicketStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateDeskTicketDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsEnum(DeskTicketStatus)
  status?: DeskTicketStatus;

  @IsOptional()
  @IsEnum(DeskTicketPriority)
  priority?: DeskTicketPriority;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsUUID()
  partyId?: string | null;

  @IsOptional()
  @IsUUID()
  caseId?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeMembershipId?: string | null;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;
}
