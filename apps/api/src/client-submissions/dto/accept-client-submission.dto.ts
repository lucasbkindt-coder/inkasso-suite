import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export enum DebtorResolution {
  EXISTING = "EXISTING",
  NEW = "NEW",
}

export class AcceptClientSubmissionDto {
  @IsEnum(DebtorResolution)
  debtorResolution!: DebtorResolution;

  @IsOptional()
  @IsUUID()
  debtorPartyId?: string;

  @IsOptional()
  @IsBoolean()
  strongMatchOverrideConfirmed?: boolean;

  @IsOptional()
  @IsString()
  strongMatchOverrideReason?: string;
}
