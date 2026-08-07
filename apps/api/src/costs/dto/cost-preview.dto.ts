import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Matches } from "class-validator";
export enum RvgScenario {
  SIMPLE_LETTER = "SIMPLE_LETTER",
  SIMPLE_CASE = "SIMPLE_CASE",
  REGULAR_UNCONTESTED = "REGULAR_UNCONTESTED",
  EXTENSIVE_OR_DIFFICULT = "EXTENSIVE_OR_DIFFICULT",
}
export enum InterestMode {
  CONSUMER_DEFAULT = "CONSUMER_DEFAULT",
  COMMERCIAL_DEFAULT = "COMMERCIAL_DEFAULT",
  CUSTOM = "CUSTOM",
}
export class RvgPreviewDto {
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) subjectValue!: string;
  @IsDateString() calculationDate!: string;
  @IsOptional() @IsEnum(RvgScenario) scenario: RvgScenario = RvgScenario.REGULAR_UNCONTESTED;
  @IsOptional() @IsString() customFactor?: string;
  @IsOptional() @IsBoolean() includeExpenseAllowance = true;
  @IsOptional() @IsBoolean() includeVat = false;
  @IsOptional() @IsString() vatRate?: string;
}
export class InterestPreviewDto {
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) principalAmount!: string;
  @IsDateString() fromDate!: string;
  @IsDateString() toDate!: string;
  @IsEnum(InterestMode) mode!: InterestMode;
  @IsOptional() @IsString() fixedAnnualRate?: string;
  @IsOptional() @IsString() baseRateMargin?: string;
}
