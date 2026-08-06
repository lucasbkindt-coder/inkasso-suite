import { DebtorType } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class UpdateDebtorDto {
  @IsOptional() @IsEnum(DebtorType) type?: DebtorType;
  @IsOptional() @IsString() @MaxLength(120) firstName?: string | null;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string | null;
  @IsOptional() @IsString() @MaxLength(200) companyName?: string | null;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string | null;
  @IsOptional() @IsString() @MaxLength(50) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(200) street?: string | null;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string | null;
  @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
}
