import {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationSource,
} from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateCommunicationDto {
  @IsEnum(CommunicationDirection)
  direction!: CommunicationDirection;

  @IsEnum(CommunicationChannel)
  channel!: CommunicationChannel;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @IsString()
  @MaxLength(20_000)
  summary!: string;

  @IsOptional()
  @IsEnum(CommunicationSource)
  source?: CommunicationSource;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  externalReference?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  durationSeconds?: number;
}
