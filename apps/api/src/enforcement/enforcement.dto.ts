import {
  EnforcementActionStatus,
  EnforcementActionType,
  EnforcementTitleStatus,
  EnforcementTitleType,
} from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateEnforcementTitleDto {
  @IsEnum(EnforcementTitleType) type!: EnforcementTitleType;
  @IsOptional() @IsEnum(EnforcementTitleStatus) status?: EnforcementTitleStatus;
  @IsOptional() @IsString() @MaxLength(300) courtOrAuthority?: string;
  @IsOptional() @IsString() @MaxLength(160) referenceNumber?: string;
  @IsDateString() titleDate!: string;
  @IsOptional() @IsDateString() serviceDate?: string;
  @IsOptional() @IsDateString() enforceableFrom?: string;
  @Matches(/^\d+(\.\d{1,2})?$/) principalAmount!: string;
  @IsOptional() @Matches(/^\d+(\.\d{1,2})?$/) costAmount?: string;
  @IsOptional() @Matches(/^\d+(\.\d{1,2})?$/) interestAmount?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

export class UpdateEnforcementTitleStatusDto {
  @IsEnum(EnforcementTitleStatus) status!: EnforcementTitleStatus;
}

export class CreateEnforcementActionDto {
  @IsString() titleId!: string;
  @IsEnum(EnforcementActionType) type!: EnforcementActionType;
  @Matches(/^\d+(\.\d{1,2})?$/) amountAtRequest!: string;
  @IsOptional() @IsString() @MaxLength(160) referenceNumber?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

export class UpdateEnforcementActionStatusDto {
  @IsEnum(EnforcementActionStatus) status!: EnforcementActionStatus;
}
