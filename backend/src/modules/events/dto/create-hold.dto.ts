import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, Matches, MaxLength, Min, ValidateNested } from "class-validator";

const SEAT_CODE_PATTERN = /^[A-Z0-9_-]+$/;

function normalizeCode(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toUpperCase();
}

export class HoldSeatInputDto {
  @Transform(({ value }) => normalizeCode(value))
  @IsString()
  @MaxLength(32)
  @Matches(SEAT_CODE_PATTERN)
  sector!: string;

  @Transform(({ value }) => normalizeCode(value))
  @IsString()
  @MaxLength(16)
  @Matches(SEAT_CODE_PATTERN)
  row!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  number!: number;
}

export class CreateHoldDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HoldSeatInputDto)
  seats!: HoldSeatInputDto[];
}
