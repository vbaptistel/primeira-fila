import { Transform } from "class-transformer";
import { IsString, Matches, MaxLength } from "class-validator";

const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function normalizeDomain(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.trim().toLowerCase();
}

export class SetCustomDomainDto {
  @Transform(({ value }) => normalizeDomain(value))
  @IsString()
  @MaxLength(255)
  @Matches(DOMAIN_PATTERN, { message: "domain deve ser um dominio valido (ex: ingressos.meuevento.com.br)." })
  domain!: string;
}
