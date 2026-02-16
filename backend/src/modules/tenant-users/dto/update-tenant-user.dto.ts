import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

const ROLE_PATTERN = /^(organizer_admin|operator)$/;

export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  @Matches(ROLE_PATTERN, {
    message: "role deve ser organizer_admin ou operator."
  })
  role?: "organizer_admin" | "operator";

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: "displayName deve ter no maximo 160 caracteres." })
  displayName?: string;
}
