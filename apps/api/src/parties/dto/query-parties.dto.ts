import { PartyRoleType, PartyType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class QueryPartiesDto {
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 20;
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  search?: string;
  @IsOptional() @IsEnum(PartyType) type?: PartyType;
  @IsOptional() @IsEnum(PartyRoleType) role?: PartyRoleType;
  @IsOptional() @Transform(({ value }) => value === "true" || value === true) includeDeleted =
    false;
}
