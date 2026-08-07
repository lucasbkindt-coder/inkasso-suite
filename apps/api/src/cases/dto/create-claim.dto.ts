import { IsDateString, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class CreateClaimDto {
  @IsString()
  @MaxLength(120)
  invoiceNumber!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsDateString()
  defaultDate?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: "principalAmount muss eine positive Dezimalzahl sein." })
  principalAmount!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency = "EUR";

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}
