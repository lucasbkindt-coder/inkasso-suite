import { IsOptional, IsUUID } from "class-validator";

export class AssignCaseDto {
  @IsOptional()
  @IsUUID()
  membershipId?: string | null;
}
