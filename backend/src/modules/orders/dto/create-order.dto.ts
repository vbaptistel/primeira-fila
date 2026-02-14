import { Transform, Type } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested
} from "class-validator";

function normalizeText(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

function normalizeEmail(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toLowerCase();
}

export class BuyerInputDto {
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MaxLength(160)
  name!: string;

  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(32)
  document?: string;
}

export class CreateOrderDto {
  @IsUUID()
  holdId!: string;

  @ValidateNested()
  @Type(() => BuyerInputDto)
  buyer!: BuyerInputDto;
}
