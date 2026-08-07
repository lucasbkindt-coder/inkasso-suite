import { LedgerEntrySide, LedgerEntryType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateLedgerEntryDto {
  @IsEnum(LedgerEntryType)
  type!: LedgerEntryType;

  @IsOptional()
  @IsEnum(LedgerEntrySide)
  side?: LedgerEntrySide;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: "amount muss eine positive Dezimalzahl sein." })
  amount!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency = "EUR";

  @IsDateString()
  bookingDate!: string;

  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @IsString()
  @MaxLength(1000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsUUID()
  createdByMembershipId?: string;
}
