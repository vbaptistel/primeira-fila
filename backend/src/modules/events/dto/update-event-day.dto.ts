import { PartialType } from "@nestjs/swagger";
import { CreateEventDayDto } from "./create-event-day.dto";

export class UpdateEventDayDto extends PartialType(CreateEventDayDto) {}
