import {
  AddressResearchConfidence,
  AddressResearchProviderType,
  AddressResearchReason,
  AddressResearchStatus,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class QueryAddressResearchDto {
  @IsOptional() @IsEnum(AddressResearchStatus) status?: AddressResearchStatus;
  @IsOptional() @IsEnum(AddressResearchReason) reason?: AddressResearchReason;
  @IsOptional() @IsUUID() requestedByMembershipId?: string;
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 25;
}

export class CreateAddressResearchDto {
  @IsUUID() partyId!: string;
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @IsEnum(AddressResearchReason) reason?: AddressResearchReason;
  @IsEnum(AddressResearchProviderType) provider!: AddressResearchProviderType;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsNumberString() costAmount?: string;
  @IsOptional() @IsString() @Length(3, 3) costCurrency?: string;
}

export class AddAddressResearchResultDto {
  @IsString() @MaxLength(160) street!: string;
  @IsOptional() @IsString() @MaxLength(30) houseNumber?: string;
  @IsString() @MaxLength(20) postalCode!: string;
  @IsString() @MaxLength(120) city!: string;
  @IsOptional() @IsString() @Length(2, 2) country = "DE";
  @IsOptional() @IsString() @MaxLength(160) additionalAddressLine?: string;
  @IsString() @MaxLength(120) source!: string;
  @IsOptional() @IsString() @MaxLength(200) sourceReference?: string;
  @IsOptional() @IsDateString() sourceDate?: string;
  @IsEnum(AddressResearchConfidence) confidence!: AddressResearchConfidence;
  @IsOptional() @IsString() @MaxLength(500) qualityReason?: string;
}

export class AddressResearchNoteDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
