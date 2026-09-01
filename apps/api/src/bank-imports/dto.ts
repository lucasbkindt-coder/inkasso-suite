import { BankTransactionStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class BankTransactionQueryDto {
  @IsOptional() @IsEnum(BankTransactionStatus) status?: BankTransactionStatus;
  @IsOptional() @IsUUID() importId?: string;
  @IsOptional() @IsDateString() bookingFrom?: string;
  @IsOptional() @IsDateString() bookingTo?: string;
}

export class ManualBankBookingDto {
  @IsUUID()
  caseId!: string;
}

export class IgnoreBankTransactionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class BankCaseSearchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  query!: string;
}
