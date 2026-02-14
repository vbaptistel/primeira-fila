import { SessionSeatStatus } from "../../../generated/prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class UpdateSessionSeatDto {
  @IsOptional()
  @IsEnum(SessionSeatStatus)
  status?: SessionSeatStatus;
}
