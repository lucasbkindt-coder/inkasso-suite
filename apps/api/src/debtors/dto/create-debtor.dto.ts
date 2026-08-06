import { DebtorType } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class CreateDebtorDto {
  @IsEnum(DebtorType) type!: DebtorType;
  @IsOptional() @IsString() @MaxLength(120) firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) street?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
}
