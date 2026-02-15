import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";

const VERSION_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function normalizeVersion(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toLowerCase();
}

function normalizeCurrencyCode(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toUpperCase();
}

export class CreateCommercialPolicyVersionDto {
  @Transform(({ value }) => normalizeVersion(value))
  @IsString()
  @MaxLength(80)
  @Matches(VERSION_PATTERN)
  version!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(25)
  serviceFeePercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  serviceFeeFixedCents!: number;

  @Transform(({ value }) => normalizeCurrencyCode(value))
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
