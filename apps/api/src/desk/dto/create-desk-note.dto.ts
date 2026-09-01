import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateDeskNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  message!: string;
}
