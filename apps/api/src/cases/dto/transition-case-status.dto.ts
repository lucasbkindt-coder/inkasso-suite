import { CaseStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class TransitionCaseStatusDto {
  @IsEnum(CaseStatus)
  targetStatus!: CaseStatus;
}
