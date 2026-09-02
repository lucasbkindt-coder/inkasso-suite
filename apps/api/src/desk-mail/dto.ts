import { MailAccountProvider, MailAccountStatus, MailReviewStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateMailAccountDto {
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsEmail() @MaxLength(320) emailAddress!: string;
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsEnum(MailAccountProvider) provider!: MailAccountProvider;
  @IsOptional() @IsBoolean() isDefault = false;
  @IsOptional() @IsBoolean() inboundEnabled = false;
  @IsOptional() @IsBoolean() outboundEnabled = false;
  @IsOptional() @IsInt() @Min(1) @Max(10_000) outboundRateLimit?: number;
}
export class UpdateMailAccountDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsOptional() @IsEnum(MailAccountStatus) status?: MailAccountStatus;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() inboundEnabled?: boolean;
  @IsOptional() @IsBoolean() outboundEnabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(10_000) outboundRateLimit?: number;
}
export class MailCredentialDto {
  @IsString() @MaxLength(255) smtpHost!: string;
  @IsInt() @Min(1) @Max(65535) smtpPort!: number;
  @IsBoolean() smtpSecure!: boolean;
  @IsString() @MaxLength(320) smtpUsername!: string;
  @IsString() @MinLength(1) @MaxLength(1000) smtpPassword!: string;
  @IsString() @MaxLength(255) imapHost!: string;
  @IsInt() @Min(1) @Max(65535) imapPort!: number;
  @IsBoolean() imapSecure!: boolean;
  @IsString() @MaxLength(320) imapUsername!: string;
  @IsString() @MinLength(1) @MaxLength(1000) imapPassword!: string;
}
export class MailListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(MailReviewStatus) status?: MailReviewStatus;
}
export class ResolveMailReviewDto {
  @IsOptional() @IsUUID() ticketId?: string;
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @IsBoolean() ignored?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
export class CreateMailDraftDto {
  @IsUUID() ticketId!: string;
  @IsUUID() mailAccountId!: string;
  @IsArray() @ArrayMaxSize(20) @IsEmail({}, { each: true }) toAddresses!: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsEmail({}, { each: true }) ccAddresses: string[] =
    [];
  @IsString() @MinLength(1) @MaxLength(998) subject!: string;
  @IsString() @MinLength(1) @MaxLength(100_000) bodyPlain!: string;
  @IsOptional() @IsString() @MaxLength(100_000) bodyHtml?: string;
}
export class UpdateMailDraftDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsEmail({}, { each: true }) toAddresses?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsEmail({}, { each: true }) ccAddresses?: string[];
  @IsOptional() @IsString() @MinLength(1) @MaxLength(998) subject?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100_000) bodyPlain?: string;
}
export class CannedResponseDto {
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(998) subject?: string;
  @IsString() @MinLength(1) @MaxLength(100_000) body!: string;
}
export class SignatureDto {
  @IsString() @MaxLength(20_000) bodyPlain!: string;
  @IsOptional() @IsString() @MaxLength(20_000) bodyHtml?: string;
}
