import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateRefundDto {
  @IsString()
  @MaxLength(60)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonDescription?: string;
}
