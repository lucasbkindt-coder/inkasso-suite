import { PartyRoleType, PartyType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { AddressDto } from "./address.dto";
import { ContactDto } from "./contact.dto";

export class CreatePartyDto {
  @IsEnum(PartyType) type!: PartyType;
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsOptional() @IsString() @MaxLength(40) salutation?: string;
  @IsOptional() @IsString() @MaxLength(60) title?: string;
  @IsOptional() @IsString() @MaxLength(120) firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @IsOptional() @IsString() @MaxLength(80) legalForm?: string;
  @IsOptional() @IsString() @MaxLength(80) vatId?: string;
  @IsOptional() @IsString() @MaxLength(80) taxNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) commercialRegister?: string;
  @IsOptional() @IsString() @MaxLength(80) registerNumber?: string;
  @IsArray() @IsEnum(PartyRoleType, { each: true }) roles: PartyRoleType[] = [];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses: AddressDto[] = [];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts: ContactDto[] = [];
}
