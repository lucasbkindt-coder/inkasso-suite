import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateCommunicationDto {
  @IsOptional()
  @IsUUID()
  caseId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  summary?: string;
}
