import { DataSubjectDataAction, DataSubjectRequestStatus, DataSubjectRequestType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateDataSubjectRequestDto {
  @IsOptional() @IsUUID() subjectPartyId?: string;
  @IsOptional() @IsUUID() clientContactId?: string;
  @IsEnum(DataSubjectRequestType) requestType!: DataSubjectRequestType;
  @IsOptional() @IsDateString() receivedAt?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsUUID() assignedMembershipId?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
}
export class UpdateDataSubjectRequestDto {
  @IsOptional() @IsEnum(DataSubjectRequestStatus) status?: DataSubjectRequestStatus;
  @IsOptional() @IsUUID() assignedMembershipId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsString() @MaxLength(1000) decision?: string;
  @IsOptional() @IsString() @MaxLength(4000) decisionReason?: string;
}
export class VerifyIdentityDto {
  @IsOptional() @IsDateString() verifiedAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
export class ReviewDataDto { @IsEnum(DataSubjectDataAction) finalAction!: DataSubjectDataAction; @IsOptional() @IsString() @MaxLength(4000) reason?: string; }
