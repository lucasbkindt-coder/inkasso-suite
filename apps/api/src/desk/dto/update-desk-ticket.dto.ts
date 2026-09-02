import { DeskTicketPriority, DeskTicketStatus } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateDeskTicketDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
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
