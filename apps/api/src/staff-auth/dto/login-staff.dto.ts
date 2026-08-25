import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class LoginStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsUUID()
  membershipId?: string;
}
