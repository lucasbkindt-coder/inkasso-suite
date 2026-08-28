import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateClientContactDto {
  @IsString() @MaxLength(120) firstName!: string;
  @IsString() @MaxLength(120) lastName!: string;
  @IsOptional() @IsString() @MaxLength(40) salutation?: string;
  @IsOptional() @IsString() @MaxLength(60) title?: string;
  @IsOptional() @IsString() @MaxLength(160) position?: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
  @IsOptional() @IsString() @MaxLength(60) phone?: string;
  @IsOptional() @IsString() @MaxLength(60) mobile?: string;
  @IsOptional() @IsBoolean() isPrimary = false;
  @IsOptional() @IsBoolean() isActive = true;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
