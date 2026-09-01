import { DeskTicketPriority } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateDeskTicketDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  subject!: string;

  @IsOptional()
  @IsEnum(DeskTicketPriority)
  priority: DeskTicketPriority = DeskTicketPriority.NORMAL;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @IsUUID()
  assigneeMembershipId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  firstInternalNote?: string;
}
