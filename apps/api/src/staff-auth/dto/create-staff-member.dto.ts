import { ArrayUnique, IsArray, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateStaffMemberDto {
  @IsString()
  @MaxLength(160)
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  initialPassword!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  roleIds?: string[];
}
