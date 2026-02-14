import { BadRequestException, Injectable } from "@nestjs/common";
import { PaymentMethod, PaymentStatus } from "../../generated/prisma/client";
import { createHash, randomUUID } from "node:crypto";

type ChargePaymentInput = {
  provider?: string;
  method: PaymentMethod;
  cardToken?: string;
  amountCents: number;
  currencyCode: string;
  orderId: string;
};

type ChargePaymentResult = {
  provider: string;
  providerPaymentId: string;
  status: PaymentStatus;
  providerPayload: Record<string, unknown>;
};

@Injectable()
export class PaymentGatewayService {
  async charge(input: ChargePaymentInput): Promise<ChargePaymentResult> {
    this.assertInput(input);

    const provider = input.provider ?? "mock_gateway";
    const denied = this.shouldDeny(input.method, input.cardToken);
    const status = denied ? PaymentStatus.DENIED : PaymentStatus.APPROVED;
    const providerPaymentId = this.buildProviderPaymentId(input.orderId, provider);

    return {
      provider,
      providerPaymentId,
      status,
      providerPayload: {
        provider,
        status,
        method: input.method,
        amountCents: input.amountCents,
        currencyCode: input.currencyCode
      }
    };
  }

  private assertInput(input: ChargePaymentInput): void {
    if (input.amountCents <= 0) {
      throw new BadRequestException("Valor do pagamento deve ser maior que zero.");
    }

    if (input.method !== PaymentMethod.PIX && !input.cardToken) {
      throw new BadRequestException("cardToken obrigatorio para pagamento em cartao.");
    }
  }

  private shouldDeny(method: PaymentMethod, cardToken: string | undefined): boolean {
    if (method === PaymentMethod.PIX) {
      return false;
    }

    const normalized = (cardToken ?? "").toLowerCase();
    return (
      normalized.includes("declined") ||
      normalized.includes("denied") ||
      normalized.includes("fail")
    );
  }

  private buildProviderPaymentId(orderId: string, provider: string): string {
    const digest = createHash("sha256").update(`${provider}:${orderId}:${randomUUID()}`).digest("hex");
    return `${provider}_${digest.slice(0, 24)}`;
  }
}
