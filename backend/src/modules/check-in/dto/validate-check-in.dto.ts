import { IsString, MaxLength } from "class-validator";

export class ValidateCheckInDto {
  @IsString()
  @MaxLength(64)
  qrCode!: string;
}
