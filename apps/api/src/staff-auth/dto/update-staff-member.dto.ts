import { ArrayUnique, IsArray, IsEnum, IsOptional, IsUUID } from "class-validator";
import { MembershipStatus } from "@prisma/client";

export class UpdateStaffMemberDto {
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  roleIds?: string[];
}
