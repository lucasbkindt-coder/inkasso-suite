import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class SearchZohoDeskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  query!: string;
}

export class LinkZohoDeskEntityDto {
  @IsString()
  @Matches(/^\d+$/, { message: "Die externe Zoho-ID muss numerisch sein." })
  externalId!: string;
}
