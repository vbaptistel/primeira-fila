import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CommercialPoliciesService } from "../commercial-policies/commercial-policies.service";
import { PaymentGatewayService } from "./payment-gateway.service";
import { AuditService } from "../../common/audit/audit.service";
import { EmailService } from "../../common/email/email.service";
import { OrderStatus, PaymentStatus } from "../../generated/prisma/client";

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((i) => stableStringify(i)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function computeRequestHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function buildMockPrisma() {
  const txClient = {
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    payment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    sessionHold: {
      findUnique: vi.fn(),
      updateMany: vi.fn()
    },
    sessionHoldSeat: {
      findMany: vi.fn()
    },
    sessionSeat: {
      updateMany: vi.fn()
    },
    ticket: {
      createMany: vi.fn()
    }
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient)),
    order: {
      findUnique: vi.fn()
    },
    payment: {
      findUnique: vi.fn()
    }
  } as unknown as PrismaService;

  return { prisma, txClient };
}

describe("OrdersService - idempotencia de pagamento", () => {
  let service: OrdersService;
  let prisma: PrismaService;
  let gateway: PaymentGatewayService;

  beforeEach(() => {
    const mocks = buildMockPrisma();
    prisma = mocks.prisma;
    gateway = { charge: vi.fn() } as unknown as PaymentGatewayService;
    const commercialPolicies = {} as CommercialPoliciesService;
    const auditService = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const emailService = { sendOrderConfirmation: vi.fn().mockResolvedValue(undefined) } as unknown as EmailService;
    const magicLinkTokenService = { generateToken: vi.fn(), validateToken: vi.fn(), buildOrderAccessUrl: vi.fn() } as never;
    service = new OrdersService(prisma, commercialPolicies, gateway, auditService, emailService, magicLinkTokenService);
  });

  describe("createOrderPayment - idempotencia", () => {
    it("deve retornar pagamento existente quando idempotency key ja foi usada com mesmo payload", async () => {
      const dto = { method: "PIX" as never };
      const hashPayload = {
        orderId: "order-001",
        gateway: undefined,
        method: "PIX",
        cardToken: undefined
      };
      const existingPayment = {
        id: "pay-001",
        idempotencyKey: "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee",
        requestHash: computeRequestHash(hashPayload),
        status: PaymentStatus.APPROVED,
        order: { id: "order-001", items: [] }
      };

      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(existingPayment);

      const result = await service.createOrderPayment(
        "order-001",
        "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee",
        dto
      );

      expect(result).toEqual(existingPayment);
      expect(gateway.charge).not.toHaveBeenCalled();
    });

    it("deve rejeitar quando idempotency key ja foi usada com payload diferente", async () => {
      const existingPayment = {
        id: "pay-001",
        idempotencyKey: "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee",
        requestHash: "hash-original",
        status: PaymentStatus.APPROVED,
        order: { id: "order-001", items: [] }
      };

      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(existingPayment);

      await expect(
        service.createOrderPayment(
          "order-001",
          "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee",
          { method: "CREDIT_CARD" as never, cardToken: "tok_different" }
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("processWebhook - idempotencia", () => {
    it("deve retornar sem alterar quando status do webhook ja esta aplicado", async () => {
      const payment = {
        id: "pay-001",
        providerPaymentId: "gw_123",
        status: PaymentStatus.APPROVED,
        order: { id: "order-001", status: OrderStatus.PAID, items: [] }
      };

      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(payment);

      const result = await service.processWebhook({
        providerPaymentId: "gw_123",
        status: PaymentStatus.APPROVED
      });

      expect(result.processed).toBe(false);
      expect(result.reason).toContain("ja aplicado");
    });

    it("deve retornar sem alterar quando pagamento esta em estado terminal (REFUNDED)", async () => {
      const payment = {
        id: "pay-001",
        providerPaymentId: "gw_456",
        status: PaymentStatus.REFUNDED,
        order: { id: "order-001", status: OrderStatus.CANCELLED, items: [] }
      };

      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(payment);

      const result = await service.processWebhook({
        providerPaymentId: "gw_456",
        status: PaymentStatus.APPROVED
      });

      expect(result.processed).toBe(false);
      expect(result.reason).toContain("terminal");
    });

    it("deve rejeitar quando providerPaymentId nao existe", async () => {
      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);

      await expect(
        service.processWebhook({
          providerPaymentId: "gw_inexistente",
          status: PaymentStatus.APPROVED
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createOrder - idempotencia", () => {
    it("deve retornar pedido existente quando idempotency key ja foi usada com mesmo payload", async () => {
      const dto = { holdId: "hold-001", buyer: { name: "Test", email: "test@test.com" } };
      const existingOrder = {
        id: "order-001",
        idempotencyKey: "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee",
        requestHash: computeRequestHash(dto),
        status: OrderStatus.PENDING_PAYMENT,
        items: []
      };

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(existingOrder);

      const result = await service.createOrder(
        "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee",
        dto
      );

      expect(result).toEqual(existingOrder);
    });

    it("deve rejeitar quando idempotency key ja foi usada com payload diferente", async () => {
      const existingOrder = {
        id: "order-001",
        idempotencyKey: "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee",
        requestHash: "hash-original",
        status: OrderStatus.PENDING_PAYMENT,
        items: []
      };

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(existingOrder);

      await expect(
        service.createOrder(
          "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee",
          { holdId: "hold-different", buyer: { name: "Other", email: "other@test.com" } }
        )
      ).rejects.toThrow(ConflictException);
    });
  });
});
