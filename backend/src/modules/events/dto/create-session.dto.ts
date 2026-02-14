import { Transform, Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, MaxLength, Min } from "class-validator";
import { SessionStatus } from "@prisma/client";

function normalizeCurrencyCode(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.toUpperCase();
}

export class CreateSessionDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsDateString()
  salesStartsAt?: string;

  @IsOptional()
  @IsDateString()
  salesEndsAt?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @Transform(({ value }) => normalizeCurrencyCode(value))
  @IsString()
  @Length(3, 3)
  currencyCode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}
