import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { PaymentStatus } from "../../../generated/prisma/client";

export class WebhookPaymentDto {
  @IsString()
  @MaxLength(80)
  providerPaymentId!: string;

  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
