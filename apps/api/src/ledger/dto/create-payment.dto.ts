import { AllocationPolicy } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  IsUUID,
  ValidateNested,
} from "class-validator";

class ManualAllocationDto {
  @IsUUID()
  targetEntryId!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;
}

export class CreatePaymentDto {
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: "amount muss eine positive Dezimalzahl sein." })
  amount!: string;

  @IsDateString()
  bookingDate!: string;

  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency = "EUR";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(AllocationPolicy)
  allocationPolicy: AllocationPolicy = AllocationPolicy.BGB_367_DEFAULT;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationDto)
  allocations?: ManualAllocationDto[];
}
