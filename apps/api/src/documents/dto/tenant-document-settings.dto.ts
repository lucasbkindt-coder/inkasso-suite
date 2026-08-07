import { IsEmail, IsOptional, IsString, Matches } from "class-validator";
export class TenantDocumentSettingsDto {
  @IsString() companyName!: string;
  @IsString() street!: string;
  @IsString() postalCode!: string;
  @IsString() city!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Matches(/^[A-Z]{2}[0-9A-Z]{13,32}$/) iban?: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() houseNumber?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() fax?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() registrationCourt?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsString() vatId?: string;
  @IsOptional() @IsString() managingDirector?: string;
  @IsOptional() @IsString() bic?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() creditorId?: string;
  @IsOptional() @IsString() documentFooter?: string;
}
