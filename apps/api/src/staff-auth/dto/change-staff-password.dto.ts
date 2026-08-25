import { IsString, MinLength } from "class-validator";

export class ChangeStaffPasswordDto {
  @IsString()
  @MinLength(12)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}
