import { DocumentType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from "class-validator";
export class TemplateDto {
  @IsString() @MaxLength(160) name!: string;
  @IsString() @Matches(/^[a-z0-9-]+$/) key!: string;
  @IsEnum(DocumentType) type!: DocumentType;
  @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @IsString() @MaxLength(20000) bodyTemplate!: string;
}
