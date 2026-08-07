import { ContactType } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class ContactDto {
  @IsEnum(ContactType) type!: ContactType;
  @IsString() @MaxLength(320) value!: string;
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsOptional() @IsBoolean() isPrimary = false;
}
