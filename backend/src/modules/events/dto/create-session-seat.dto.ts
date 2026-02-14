import { SessionSeatStatus } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";

const SEAT_CODE_PATTERN = /^[A-Z0-9_-]+$/;

function normalizeCode(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toUpperCase();
}

export class CreateSessionSeatDto {
  @Transform(({ value }) => normalizeCode(value))
  @IsString()
  @MaxLength(32)
  @Matches(SEAT_CODE_PATTERN)
  sectorCode!: string;

  @Transform(({ value }) => normalizeCode(value))
  @IsString()
  @MaxLength(16)
  @Matches(SEAT_CODE_PATTERN)
  rowLabel!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatNumber!: number;

  @IsOptional()
  @IsEnum(SessionSeatStatus)
  status?: SessionSeatStatus;
}
