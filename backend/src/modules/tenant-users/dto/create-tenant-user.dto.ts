import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

const ROLE_PATTERN = /^(organizer_admin|operator)$/;

export class CreateTenantUserDto {
  @IsEmail({}, { message: "email deve ser um email valido." })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: "displayName deve ter no maximo 160 caracteres." })
  displayName?: string;

  @IsString()
  @MinLength(8, { message: "password deve ter pelo menos 8 caracteres." })
  @MaxLength(128)
  password!: string;

  @IsString()
  @Matches(ROLE_PATTERN, {
    message: "role deve ser organizer_admin ou operator."
  })
  role!: "organizer_admin" | "operator";
}
