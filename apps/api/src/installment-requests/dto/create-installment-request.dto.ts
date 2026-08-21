import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, Matches } from "class-validator";

export class CreateInstallmentRequestDto {
  @Matches(/^\d+(\.\d{1,2})?$/)
  requestedMonthlyAmount!: string;
  @IsDateString()
  preferredStartDate!: string;
  @IsOptional() @IsInt() @Min(1)
  numberOfInstallments?: number;
  @IsOptional() @IsString() @MaxLength(2000)
  debtorMessage?: string;
}
