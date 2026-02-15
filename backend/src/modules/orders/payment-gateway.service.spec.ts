import { describe, it, expect, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { PaymentGatewayService } from "./payment-gateway.service";
import { PaymentMethod, PaymentStatus } from "../../generated/prisma/client";

describe("PaymentGatewayService", () => {
  let service: PaymentGatewayService;

  beforeEach(() => {
    service = new PaymentGatewayService();
  });

  describe("charge", () => {
    it("deve aprovar pagamento PIX sem cardToken", async () => {
      const result = await service.charge({
        method: PaymentMethod.PIX,
        amountCents: 5000,
        currencyCode: "BRL",
        orderId: "order-001"
      });

      expect(result.status).toBe(PaymentStatus.APPROVED);
      expect(result.provider).toBe("mock_gateway");
      expect(result.providerPaymentId).toBeTruthy();
      expect(result.providerPayload).toEqual(
        expect.objectContaining({
          method: PaymentMethod.PIX,
          amountCents: 5000,
          currencyCode: "BRL"
        })
      );
    });

    it("deve aprovar pagamento com cartao e cardToken valido", async () => {
      const result = await service.charge({
        method: PaymentMethod.CREDIT_CARD,
        cardToken: "tok_valid_abc123",
        amountCents: 10000,
        currencyCode: "BRL",
        orderId: "order-002"
      });

      expect(result.status).toBe(PaymentStatus.APPROVED);
    });

    it("deve negar pagamento quando cardToken contem 'declined'", async () => {
      const result = await service.charge({
        method: PaymentMethod.CREDIT_CARD,
        cardToken: "tok_declined_xyz",
        amountCents: 10000,
        currencyCode: "BRL",
        orderId: "order-003"
      });

      expect(result.status).toBe(PaymentStatus.DENIED);
    });

    it("deve negar pagamento quando cardToken contem 'denied'", async () => {
      const result = await service.charge({
        method: PaymentMethod.CREDIT_CARD,
        cardToken: "tok_denied_abc",
        amountCents: 10000,
        currencyCode: "BRL",
        orderId: "order-004"
      });

      expect(result.status).toBe(PaymentStatus.DENIED);
    });

    it("deve negar pagamento quando cardToken contem 'fail'", async () => {
      const result = await service.charge({
        method: PaymentMethod.CREDIT_CARD,
        cardToken: "tok_fail_test",
        amountCents: 10000,
        currencyCode: "BRL",
        orderId: "order-005"
      });

      expect(result.status).toBe(PaymentStatus.DENIED);
    });

    it("deve rejeitar valor menor ou igual a zero", async () => {
      await expect(
        service.charge({
          method: PaymentMethod.PIX,
          amountCents: 0,
          currencyCode: "BRL",
          orderId: "order-006"
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.charge({
          method: PaymentMethod.PIX,
          amountCents: -100,
          currencyCode: "BRL",
          orderId: "order-007"
        })
      ).rejects.toThrow("Valor do pagamento deve ser maior que zero.");
    });

    it("deve rejeitar cartao sem cardToken", async () => {
      await expect(
        service.charge({
          method: PaymentMethod.CREDIT_CARD,
          amountCents: 10000,
          currencyCode: "BRL",
          orderId: "order-008"
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.charge({
          method: PaymentMethod.CREDIT_CARD,
          amountCents: 10000,
          currencyCode: "BRL",
          orderId: "order-009"
        })
      ).rejects.toThrow("cardToken obrigatorio para pagamento em cartao.");
    });

    it("deve usar provider customizado quando fornecido", async () => {
      const result = await service.charge({
        provider: "stripe",
        method: PaymentMethod.PIX,
        amountCents: 5000,
        currencyCode: "BRL",
        orderId: "order-010"
      });

      expect(result.provider).toBe("stripe");
      expect(result.providerPaymentId).toContain("stripe_");
    });
  });
});
