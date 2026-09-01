import { CreditBureauEligibilityStatus, CreditBureauProvider, CreditBureauReportStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateCreditBureauReportDto {
  @IsUUID() caseId!: string;
  @IsEnum(CreditBureauProvider) provider!: CreditBureauProvider;
}
export class QueryCreditBureauReportsDto {
  @IsOptional() @IsEnum(CreditBureauReportStatus) status?: CreditBureauReportStatus;
  @IsOptional() @IsEnum(CreditBureauProvider) provider?: CreditBureauProvider;
  @IsOptional() @IsEnum(CreditBureauEligibilityStatus) eligibility?: CreditBureauEligibilityStatus;
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 25;
}
export class CreditBureauReasonDto {
  @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}
