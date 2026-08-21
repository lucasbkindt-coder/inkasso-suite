import { IsString, MaxLength, MinLength } from "class-validator";

export class ActivatePortalAccountDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  loginIdentifier!: string;

  @IsString()
  @MinLength(16)
  @MaxLength(256)
  activationCode!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(256)
  newPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(256)
  confirmPassword!: string;
}
