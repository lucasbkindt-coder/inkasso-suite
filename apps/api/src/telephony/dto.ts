import {
  AgentPresenceStatus,
  CallDirection,
  CallDisposition,
  CallStatus,
  TelephonyProviderStatus,
  TelephonyProviderType,
  TelephonyTransport,
} from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, MinLength } from "class-validator";

const Trim = () => Transform(({ value }) => typeof value === "string" ? value.trim() : value);

export class UpsertProviderConfigDto {
  @Trim() @IsString() @Length(1, 150) name!: string;
  @IsEnum(TelephonyProviderType) providerType!: TelephonyProviderType;
  @IsOptional() @IsEnum(TelephonyProviderStatus) status?: TelephonyProviderStatus;
  @IsOptional() @Trim() @IsString() @Length(1, 500) defaultRegistrar?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 500) defaultProxy?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 255) defaultDomain?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) defaultPort?: number;
  @IsOptional() @IsEnum(TelephonyTransport) defaultTransport?: TelephonyTransport;
  @IsOptional() @Trim() @IsString() @Length(1, 1000) defaultWebSocketUrl?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 1000) defaultStun?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 1000) defaultTurn?: string;
}

export class CreateStaffTelephonyAccountDto {
  @IsUUID() membershipId!: string;
  @IsUUID() telephonyProviderConfigId!: string;
  @Trim() @IsString() @Length(1, 150) name!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @Trim() @IsString() @Length(1, 50) extension?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 255) authUsername?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 100) displayNumber?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 100) outboundCallerId?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 500) registrarOverride?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 500) proxyOverride?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 255) domainOverride?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) portOverride?: number;
  @IsOptional() @IsEnum(TelephonyTransport) transportOverride?: TelephonyTransport;
  @IsOptional() @Trim() @IsString() @Length(1, 1000) webSocketUrlOverride?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) maxConcurrentCalls?: number;
}

export class UpdateStaffTelephonyAccountDto {
  @IsOptional() @Trim() @IsString() @Length(1, 150) name?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @Trim() @IsString() @Length(1, 50) extension?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 255) authUsername?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 100) displayNumber?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 100) outboundCallerId?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 500) registrarOverride?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 500) proxyOverride?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 255) domainOverride?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) portOverride?: number;
  @IsOptional() @IsEnum(TelephonyTransport) transportOverride?: TelephonyTransport;
  @IsOptional() @Trim() @IsString() @Length(1, 1000) webSocketUrlOverride?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) maxConcurrentCalls?: number;
}

export class SetTelephonyCredentialsDto {
  @Trim() @IsString() @MinLength(1) sipUsername!: string;
  @IsOptional() @Trim() @IsString() sipAuthId?: string;
  @IsString() @MinLength(1) sipPassword!: string;
  @IsOptional() @Trim() @IsString() turnUsername?: string;
  @IsOptional() @IsString() turnPassword?: string;
}

export class QueryCallsDto {
  @IsOptional() @IsEnum(CallDirection) direction?: CallDirection;
  @IsOptional() @IsEnum(CallStatus) status?: CallStatus;
  @IsOptional() @IsUUID() agentMembershipId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Transform(({ value }) => value === "true" || value === true) @IsBoolean() missed?: boolean;
  @IsOptional() @Trim() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class StartCallDto {
  @Trim() @IsString() @MinLength(1) remoteNumber!: string;
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @IsUUID() ticketId?: string;
  @IsOptional() @IsUUID() staffTelephonyAccountId?: string;
}

export class MockIncomingCallDto extends StartCallDto {
  @IsOptional() @Trim() @IsString() providerCallId?: string;
}

export class CallActionDto {
  @IsIn(["ring", "answer", "hold", "resume", "mute", "unmute", "dtmf", "end", "miss", "fail"])
  action!: "ring" | "answer" | "hold" | "resume" | "mute" | "unmute" | "dtmf" | "end" | "miss" | "fail";
  @IsOptional() @Trim() @IsString() @Length(1, 1) digit?: string;
}

export class UpdateCallDto {
  @IsOptional() @IsUUID() partyId?: string | null;
  @IsOptional() @IsUUID() caseId?: string | null;
  @IsOptional() @IsUUID() ticketId?: string | null;
  @IsOptional() @IsEnum(CallDisposition) disposition?: CallDisposition;
  @IsOptional() @Trim() @IsString() @Length(1, 2000) wrapUpNote?: string;
}

export class PresenceDto {
  @IsEnum(AgentPresenceStatus) status!: AgentPresenceStatus;
}

export class CallbackTaskDto {
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 500) note?: string;
}
