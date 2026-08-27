import { IsDateString, IsInt, IsOptional, IsString, Max, Min, Matches } from "class-validator";

export class CreateStaffInstallmentPlanDto {
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: "plannedInstallmentAmount muss eine positive Dezimalzahl sein." })
  plannedInstallmentAmount!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  numberOfInstallments?: number;

  @IsDateString()
  startDate!: string;
}
