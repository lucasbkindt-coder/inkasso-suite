import { IsOptional, IsString, IsUUID } from "class-validator";
export class DocumentRenderDto {
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() templateKey?: string;
}
