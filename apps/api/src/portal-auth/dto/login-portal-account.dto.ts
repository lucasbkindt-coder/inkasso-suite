import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginPortalAccountDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  loginIdentifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
