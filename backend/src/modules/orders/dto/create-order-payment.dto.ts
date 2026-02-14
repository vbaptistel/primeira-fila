import { PaymentMethod } from "../../../generated/prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from "class-validator";

const GATEWAY_CODE_PATTERN = /^[a-z0-9_]+$/;

function normalizeGateway(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toLowerCase();
}

function normalizeToken(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

export class CreateOrderPaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @Transform(({ value }) => normalizeGateway(value))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(GATEWAY_CODE_PATTERN)
  gateway?: string;

  @Transform(({ value }) => normalizeToken(value))
  @IsOptional()
  @IsString()
  @MaxLength(128)
  cardToken?: string;
}
