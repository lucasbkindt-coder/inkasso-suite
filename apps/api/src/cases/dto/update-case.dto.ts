import { CasePhase, CasePriority, ClaimDisputeStatus, ClaimStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

class UpdateClaimDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  defaultDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: "principalAmount muss eine positive Dezimalzahl sein." })
  principalAmount?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @IsOptional()
  @IsEnum(ClaimDisputeStatus)
  disputeStatus?: ClaimDisputeStatus;
}

export class UpdateCaseDto {
  @IsOptional()
  @IsEnum(CasePhase)
  phase?: CasePhase;

  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  @IsOptional()
  @IsUUID()
  ownerMembershipId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  internalNotes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateClaimDto)
  claim?: UpdateClaimDto;
}

export { UpdateClaimDto };
