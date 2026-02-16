import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min
} from "class-validator";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUBDOMAIN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;
const COLOR_SCHEME_PATTERN = /^(light|dark|system)$/;

function normalizeSlug(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.trim().toLowerCase();
}

function normalizeSubdomain(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.trim().toLowerCase();
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeSlug(value))
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: "slug deve conter apenas letras minusculas, numeros e hifens." })
  slug?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeSubdomain(value))
  @IsString()
  @MaxLength(63)
  @Matches(SUBDOMAIN_PATTERN, {
    message: "subdomain deve conter apenas letras minusculas, numeros e hifens."
  })
  subdomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  @Matches(HEX_COLOR_PATTERN, { message: "primaryColor deve ser uma cor hexadecimal valida." })
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  @Matches(HEX_COLOR_PATTERN, { message: "secondaryColor deve ser uma cor hexadecimal valida." })
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  @Matches(HEX_COLOR_PATTERN, { message: "accentColor deve ser uma cor hexadecimal valida." })
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(COLOR_SCHEME_PATTERN, {
    message: 'colorScheme deve ser "light", "dark" ou "system".'
  })
  colorScheme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  footerText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  termsUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  privacyUrl?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1, { message: "maxUsers deve ser pelo menos 1." })
  maxUsers?: number;
}
