import { EventStatus } from "../../../generated/prisma/client";
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from "class-validator";

const EVENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateEventDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(180)
  @Matches(EVENT_SLUG_PATTERN)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
