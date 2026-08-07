import { AddressType } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class AddressDto {
  @IsOptional() @IsEnum(AddressType) type: AddressType = AddressType.PRIMARY;
  @IsString() @MaxLength(160) street!: string;
  @IsOptional() @IsString() @MaxLength(30) houseNumber?: string;
  @IsOptional() @IsString() @MaxLength(160) addressLine2?: string;
  @IsString() @MaxLength(20) postalCode!: string;
  @IsString() @MaxLength(120) city!: string;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsOptional() @IsBoolean() isPrimary = false;
}
