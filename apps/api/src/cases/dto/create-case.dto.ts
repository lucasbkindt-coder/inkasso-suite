import { CasePriority } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";

import { CreateClaimDto } from "./create-claim.dto";

export class CreateCaseDto {
  @IsUUID()
  clientPartyId!: string;

  @IsUUID()
  debtorPartyId!: string;

  @IsOptional()
  @IsUUID()
  ownerMembershipId?: string;

  @IsOptional()
  @IsEnum(CasePriority)
  priority: CasePriority = CasePriority.NORMAL;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  internalNotes?: string;

  @ValidateNested()
  @Type(() => CreateClaimDto)
  claim!: CreateClaimDto;
}
