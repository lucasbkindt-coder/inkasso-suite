import { IsOptional, IsString, MaxLength } from "class-validator";

export class RejectClientSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rejectionReason?: string;
}
