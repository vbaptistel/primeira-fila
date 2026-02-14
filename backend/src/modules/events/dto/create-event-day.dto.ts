import { EventDayStatus } from "../../../generated/prisma/client";
import { IsDateString, IsEnum, IsOptional } from "class-validator";

export class CreateEventDayDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsEnum(EventDayStatus)
  status?: EventDayStatus;
}
