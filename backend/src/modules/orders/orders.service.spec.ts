import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CommercialPoliciesService } from "../commercial-policies/commercial-policies.service";
import { PaymentGatewayService } from "./payment-gateway.service";
import { AuditService } from "../../common/audit/audit.service";
import { EmailService } from "../../common/email/email.service";
import {
  EventStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  SessionHoldStatus,
  SessionSeatStatus,
  SessionStatus,
  TicketStatus
} from "../../generated/prisma/client";

const VALID_UUID = "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee";

function buildMockTxClient() {
  return {
    sessionHold: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    payment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    sessionSeat: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    sessionHoldSeat: {
      findMany: vi.fn().mockResolvedValue([])
    },
    ticket: {
      createMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    refund: {
      create: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    }
  };
}

function buildMockPrisma(txClient: ReturnType<typeof buildMockTxClient>) {
  return {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient)),
    order: {
      findUnique: vi.fn()
    },
    payment: {
      findUnique: vi.fn()
    },
    ticket: {
      findMany: vi.fn()
    }
  } as unknown as PrismaService;
}

function buildMockHold(overrides?: Partial<{
  id: string;
  tenantId: string;
  sessionId: string;
  status: SessionHoldStatus;
  expiresAt: Date;
}>) {
  return {
    id: overrides?.id ?? "hold-001",
    tenantId: overrides?.tenantId ?? "tenant-001",
    sessionId: overrides?.sessionId ?? "session-001",
    status: overrides?.status ?? SessionHoldStatus.ACTIVE,
    expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 600_000),
    session: {
      id: "session-001",
      tenantId: "tenant-001",
      priceCents: 5000,
      currencyCode: "BRL",
      status: SessionStatus.PUBLISHED,
      event: { status: EventStatus.PUBLISHED }
    },
    heldSeats: [
      {
        seatId: "seat-001",
        seat: {
          id: "seat-001",
          sectorCode: "A",
          rowLabel: "1",
          seatNumber: 10,
          status: SessionSeatStatus.HELD
        }
      }
    ]
  };
}

function buildMockOrder(overrides?: Partial<{
  id: string;
  tenantId: string;
  holdId: string;
  sessionId: string;
  status: OrderStatus;
  holdExpiresAt: Date;
  totalAmountCents: number;
}>) {
  return {
    id: overrides?.id ?? "order-001",
    tenantId: overrides?.tenantId ?? "tenant-001",
    holdId: overrides?.holdId ?? "hold-001",
    sessionId: overrides?.sessionId ?? "session-001",
    idempotencyKey: VALID_UUID,
    requestHash: "hash-123",
    status: overrides?.status ?? OrderStatus.PENDING_PAYMENT,
    buyerName: "Maria Silva",
    buyerEmail: "maria@email.com",
    buyerDocument: null,
    currencyCode: "BRL",
    ticketSubtotalCents: 5000,
    serviceFeeCents: 700,
    totalAmountCents: overrides?.totalAmountCents ?? 5700,
    commercialPolicyVersion: "platform_default_v1",
    holdExpiresAt: overrides?.holdExpiresAt ?? new Date(Date.now() + 600_000),
    items: [
      {
        id: "item-001",
        sessionId: "session-001",
        seatId: "seat-001",
        unitPriceCents: 5000,
        currencyCode: "BRL"
      }
    ]
  };
}

describe("OrdersService", () => {
  let service: OrdersService;
  let prisma: PrismaService;
  let txClient: ReturnType<typeof buildMockTxClient>;
  let gateway: PaymentGatewayService;
  let auditService: AuditService;
  let emailService: EmailService;
  let commercialPoliciesService: CommercialPoliciesService;

  beforeEach(() => {
    txClient = buildMockTxClient();
    prisma = buildMockPrisma(txClient);
    gateway = { charge: vi.fn() } as unknown as PaymentGatewayService;
    auditService = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    emailService = { sendOrderConfirmation: vi.fn().mockResolvedValue(undefined) } as unknown as EmailService;
    commercialPoliciesService = {
      getActivePolicy: vi.fn().mockResolvedValue({
        serviceFeePercentBps: 1000,
        serviceFeeFixedCents: 200,
        version: "platform_default_v1"
      })
    } as unknown as CommercialPoliciesService;
    service = new OrdersService(prisma, commercialPoliciesService, gateway, auditService, emailService);
  });

  // ─── createOrder ────────────────────────────────────────────────

  describe("createOrder", () => {
    it("deve criar pedido com sucesso a partir de hold ativa", async () => {
      const hold = buildMockHold();
      const createdOrder = buildMockOrder();

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.sessionHold.findUnique.mockResolvedValue(hold);
      txClient.order.findUnique.mockResolvedValue(null);
      txClient.order.create.mockResolvedValue(createdOrder);

      const result = await service.createOrder(VALID_UUID, {
        holdId: "hold-001",
        buyer: { name: "Maria Silva", email: "maria@email.com" }
      });

      expect(result).toEqual(createdOrder);
    });

    it("deve lancar NotFoundException quando hold nao encontrada", async () => {
      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.sessionHold.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder(VALID_UUID, {
          holdId: "hold-inexistente",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("deve lancar ConflictException quando sessao nao publicada", async () => {
      const hold = buildMockHold();
      hold.session.status = SessionStatus.DRAFT as never;

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.sessionHold.findUnique.mockResolvedValue(hold);

      await expect(
        service.createOrder(VALID_UUID, {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(ConflictException);
    });

    it("deve lancar ConflictException quando evento arquivado", async () => {
      const hold = buildMockHold();
      hold.session.event.status = EventStatus.ARCHIVED as never;

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.sessionHold.findUnique.mockResolvedValue(hold);

      await expect(
        service.createOrder(VALID_UUID, {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(ConflictException);
    });

    it("deve lancar ConflictException quando hold ja usada para outro pedido", async () => {
      const hold = buildMockHold();
      const existingOrder = buildMockOrder();

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.sessionHold.findUnique.mockResolvedValue(hold);
      txClient.order.findUnique.mockResolvedValue(existingOrder);

      await expect(
        service.createOrder(VALID_UUID, {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(ConflictException);
    });

    it("deve lancar GoneException quando hold expirada", async () => {
      const hold = buildMockHold({
        status: SessionHoldStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 60_000)
      });

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.sessionHold.findUnique.mockResolvedValue(hold);
      txClient.order.findUnique.mockResolvedValue(null);
      txClient.sessionHold.updateMany.mockResolvedValue({ count: 1 });
      txClient.sessionSeat.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.createOrder(VALID_UUID, {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(GoneException);
    });

    it("deve lancar ConflictException quando hold sem assentos", async () => {
      const hold = buildMockHold();
      hold.heldSeats = [];

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.sessionHold.findUnique.mockResolvedValue(hold);
      txClient.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder(VALID_UUID, {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(ConflictException);
    });

    it("deve lancar ConflictException quando assentos nao mais HELD", async () => {
      const hold = buildMockHold();
      hold.heldSeats[0].seat.status = SessionSeatStatus.AVAILABLE as never;

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.sessionHold.findUnique.mockResolvedValue(hold);
      txClient.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder(VALID_UUID, {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(ConflictException);
    });

    it("deve calcular service fee usando politica comercial ativa", async () => {
      const hold = buildMockHold();
      hold.heldSeats = [
        {
          seatId: "seat-001",
          seat: { id: "seat-001", sectorCode: "A", rowLabel: "1", seatNumber: 1, status: SessionSeatStatus.HELD }
        },
        {
          seatId: "seat-002",
          seat: { id: "seat-002", sectorCode: "A", rowLabel: "1", seatNumber: 2, status: SessionSeatStatus.HELD }
        }
      ] as never;

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.sessionHold.findUnique.mockResolvedValue(hold);
      txClient.order.findUnique.mockResolvedValue(null);
      txClient.order.create.mockResolvedValue(buildMockOrder());

      await service.createOrder(VALID_UUID, {
        holdId: "hold-001",
        buyer: { name: "Maria", email: "maria@email.com" }
      });

      // 2 seats * 5000 = 10000 subtotal
      // 10000 * 10% (1000 bps) + 200 fixed = 1200 service fee
      // total = 11200
      expect(txClient.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketSubtotalCents: 10000,
            serviceFeeCents: 1200,
            totalAmountCents: 11200,
            commercialPolicyVersion: "platform_default_v1"
          })
        })
      );
    });

    it("deve lancar BadRequestException quando idempotency key ausente", async () => {
      await expect(
        service.createOrder(undefined, {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createOrder(undefined, {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow("Header Idempotency-Key obrigatorio.");
    });

    it("deve lancar BadRequestException quando idempotency key nao e UUID valido", async () => {
      await expect(
        service.createOrder("nao-e-uuid", {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createOrder("nao-e-uuid", {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow("Header Idempotency-Key deve ser um UUID valido.");
    });
  });

  // ─── createOrderPayment ─────────────────────────────────────────

  describe("createOrderPayment", () => {
    it("deve processar pagamento aprovado e aprovar pedido", async () => {
      const order = buildMockOrder();
      const payment = {
        id: "pay-001",
        idempotencyKey: VALID_UUID,
        requestHash: "hash",
        status: PaymentStatus.APPROVED,
        order: { ...order, status: OrderStatus.PAID, items: order.items }
      };

      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.order.findUnique.mockResolvedValue(order);
      vi.mocked(gateway.charge).mockResolvedValue({
        provider: "mock_gateway",
        providerPaymentId: "gw_123",
        status: PaymentStatus.APPROVED,
        providerPayload: {}
      });
      txClient.payment.create.mockResolvedValue(payment);
      txClient.payment.findUnique.mockResolvedValue(payment);
      txClient.order.update.mockResolvedValue({ ...order, status: OrderStatus.PAID });
      txClient.ticket.createMany.mockResolvedValue({ count: 1 });

      const result = await service.createOrderPayment("order-001", VALID_UUID, {
        method: PaymentMethod.PIX
      });

      expect(result?.order?.status).toBe(OrderStatus.PAID);
      expect(txClient.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: OrderStatus.PAID }
        })
      );
    });

    it("deve lancar NotFoundException quando pedido nao encontrado", async () => {
      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrderPayment("order-inexistente", VALID_UUID, {
          method: PaymentMethod.PIX
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("deve lancar GoneException quando pedido expirado", async () => {
      const order = buildMockOrder({
        holdExpiresAt: new Date(Date.now() - 60_000)
      });

      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.order.findUnique.mockResolvedValue(order);
      txClient.order.updateMany.mockResolvedValue({ count: 1 });
      txClient.sessionHold.updateMany.mockResolvedValue({ count: 1 });
      txClient.sessionSeat.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.createOrderPayment("order-001", VALID_UUID, {
          method: PaymentMethod.PIX
        })
      ).rejects.toThrow(GoneException);
    });

    it("deve lancar ConflictException quando pedido nao aceita pagamento", async () => {
      const order = buildMockOrder({ status: OrderStatus.PAID });

      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.order.findUnique.mockResolvedValue(order);

      await expect(
        service.createOrderPayment("order-001", VALID_UUID, {
          method: PaymentMethod.PIX
        })
      ).rejects.toThrow(ConflictException);
    });

    it("nao deve aprovar pedido quando pagamento negado", async () => {
      const order = buildMockOrder();
      const payment = {
        id: "pay-001",
        status: PaymentStatus.DENIED,
        order: { ...order, status: OrderStatus.PENDING_PAYMENT, items: order.items }
      };

      (prisma.payment as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      txClient.order.findUnique.mockResolvedValue(order);
      vi.mocked(gateway.charge).mockResolvedValue({
        provider: "mock_gateway",
        providerPaymentId: "gw_456",
        status: PaymentStatus.DENIED,
        providerPayload: {}
      });
      txClient.payment.create.mockResolvedValue(payment);
      txClient.payment.findUnique.mockResolvedValue(payment);

      const result = await service.createOrderPayment("order-001", VALID_UUID, {
        method: PaymentMethod.CREDIT_CARD,
        cardToken: "tok_declined"
      });

      expect(result?.order?.status).toBe(OrderStatus.PENDING_PAYMENT);
      expect(txClient.order.update).not.toHaveBeenCalled();
    });
  });

  // ─── createRefund ───────────────────────────────────────────────

  describe("createRefund", () => {
    it("deve criar reembolso completo com sucesso", async () => {
      const order = {
        ...buildMockOrder({ status: OrderStatus.PAID }),
        payments: [
          { id: "pay-001", status: PaymentStatus.APPROVED, amountCents: 5700 }
        ]
      };
      const refund = {
        id: "refund-001",
        tenantId: "tenant-001",
        orderId: "order-001",
        paymentId: "pay-001",
        reasonCode: "CUSTOMER_REQUEST",
        amountCents: 5700,
        status: RefundStatus.APPROVED,
        requestedBy: "actor-001"
      };

      txClient.order.findUnique.mockResolvedValue(order);
      txClient.refund.create.mockResolvedValue(refund);
      txClient.payment.update.mockResolvedValue({});
      txClient.order.update.mockResolvedValue({});
      txClient.ticket.updateMany.mockResolvedValue({ count: 1 });
      txClient.sessionSeat.updateMany.mockResolvedValue({ count: 1 });
      txClient.sessionHold.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.createRefund(
        "tenant-001", "order-001", "actor-001",
        { reasonCode: "CUSTOMER_REQUEST" }
      );

      expect(result).toEqual(refund);
      expect(txClient.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PaymentStatus.REFUNDED }
        })
      );
      expect(txClient.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: OrderStatus.CANCELLED }
        })
      );
      expect(txClient.ticket.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TicketStatus.CANCELLED }
        })
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "REFUND_APPROVED",
          resourceType: "refund"
        }),
        expect.anything()
      );
    });

    it("deve lancar NotFoundException quando pedido nao encontrado", async () => {
      txClient.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createRefund("tenant-001", "order-inexistente", "actor-001", {
          reasonCode: "CUSTOMER_REQUEST"
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("deve lancar NotFoundException quando tenantId diverge", async () => {
      const order = {
        ...buildMockOrder({ tenantId: "tenant-outro" }),
        payments: []
      };
      txClient.order.findUnique.mockResolvedValue(order);

      await expect(
        service.createRefund("tenant-001", "order-001", "actor-001", {
          reasonCode: "CUSTOMER_REQUEST"
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("deve lancar ConflictException quando pedido nao esta PAID", async () => {
      const order = {
        ...buildMockOrder({ status: OrderStatus.PENDING_PAYMENT }),
        payments: []
      };
      txClient.order.findUnique.mockResolvedValue(order);

      await expect(
        service.createRefund("tenant-001", "order-001", "actor-001", {
          reasonCode: "CUSTOMER_REQUEST"
        })
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createRefund("tenant-001", "order-001", "actor-001", {
          reasonCode: "CUSTOMER_REQUEST"
        })
      ).rejects.toThrow("Somente pedidos pagos podem ser reembolsados.");
    });

    it("deve lancar ConflictException quando nenhum pagamento aprovado encontrado", async () => {
      const order = {
        ...buildMockOrder({ status: OrderStatus.PAID }),
        payments: []
      };
      txClient.order.findUnique.mockResolvedValue(order);

      await expect(
        service.createRefund("tenant-001", "order-001", "actor-001", {
          reasonCode: "CUSTOMER_REQUEST"
        })
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createRefund("tenant-001", "order-001", "actor-001", {
          reasonCode: "CUSTOMER_REQUEST"
        })
      ).rejects.toThrow("Nenhum pagamento aprovado encontrado para reembolso.");
    });
  });

  // ─── getOrderTickets ────────────────────────────────────────────

  describe("getOrderTickets", () => {
    it("deve retornar tickets do pedido com seat e session", async () => {
      const tickets = [
        {
          id: "ticket-001",
          qrCode: "qr-001",
          status: TicketStatus.VALID,
          seat: { id: "seat-001", sectorCode: "A", rowLabel: "1", seatNumber: 10 },
          session: { id: "session-001", name: "Sessao Tarde", startsAt: new Date(), endsAt: new Date() }
        }
      ];

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue({ id: "order-001" });
      vi.mocked(prisma.ticket.findMany).mockResolvedValue(tickets as never);

      const result = await service.getOrderTickets("order-001");

      expect(result).toEqual(tickets);
    });

    it("deve lancar NotFoundException quando pedido nao encontrado", async () => {
      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);

      await expect(
        service.getOrderTickets("order-inexistente")
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Concorrencia (P2034) ──────────────────────────────────────

  describe("tratamento de erro P2034", () => {
    it("deve converter P2034 em ConflictException no createOrder", async () => {
      const prismaError = new Error("Serialization failure") as Error & { code: string };
      prismaError.code = "P2034";

      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(prismaError);

      await expect(
        service.createOrder(VALID_UUID, {
          holdId: "hold-001",
          buyer: { name: "Test", email: "test@test.com" }
        })
      ).rejects.toThrow(ConflictException);
    });

    it("deve converter P2034 em ConflictException no createRefund", async () => {
      const prismaError = new Error("Serialization failure") as Error & { code: string };
      prismaError.code = "P2034";

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(prismaError);

      await expect(
        service.createRefund("tenant-001", "order-001", "actor-001", {
          reasonCode: "CUSTOMER_REQUEST"
        })
      ).rejects.toThrow(ConflictException);
    });
  });
});
