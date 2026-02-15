import { IsEmail } from "class-validator";
import { Transform } from "class-transformer";

export class RequestOrderAccessDto {
  @IsEmail({}, { message: "E-mail invalido." })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  email!: string;
}
