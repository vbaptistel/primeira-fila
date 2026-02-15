import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { EventsService } from "./events.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CommercialPoliciesService } from "../commercial-policies/commercial-policies.service";
import {
  SessionSeatStatus,
  SessionHoldStatus
} from "../../generated/prisma/client";

function buildMockPrismaService() {
  const txClient = {
    session: {
      findFirst: vi.fn()
    },
    sessionHold: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    sessionHoldSeat: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn()
    },
    sessionSeat: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  } as unknown as PrismaService;

  return { prisma, txClient };
}

function buildMockSession(overrides?: Partial<{ id: string; tenantId: string }>) {
  return {
    id: overrides?.id ?? "session-001",
    tenantId: overrides?.tenantId ?? "tenant-001"
  };
}

function buildMockSeat(overrides?: Partial<{
  id: string;
  sessionId: string;
  sectorCode: string;
  rowLabel: string;
  seatNumber: number;
  status: SessionSeatStatus;
}>) {
  return {
    id: overrides?.id ?? "seat-001",
    sessionId: overrides?.sessionId ?? "session-001",
    sectorCode: overrides?.sectorCode ?? "A",
    rowLabel: overrides?.rowLabel ?? "A",
    seatNumber: overrides?.seatNumber ?? 1,
    status: overrides?.status ?? SessionSeatStatus.AVAILABLE
  };
}

describe("EventsService - concorrencia de assentos", () => {
  let service: EventsService;
  let prisma: PrismaService;
  let txClient: ReturnType<typeof buildMockPrismaService>["txClient"];
  let commercialPoliciesService: CommercialPoliciesService;

  beforeEach(() => {
    const mocks = buildMockPrismaService();
    prisma = mocks.prisma;
    txClient = mocks.txClient;
    commercialPoliciesService = {} as CommercialPoliciesService;
    service = new EventsService(prisma, commercialPoliciesService);
  });

  describe("hold em assento ja reservado (HELD)", () => {
    it("deve rejeitar hold quando assento esta HELD por outra hold", async () => {
      txClient.session.findFirst.mockResolvedValue(buildMockSession());
      txClient.sessionSeat.findMany.mockResolvedValue([
        buildMockSeat({ status: SessionSeatStatus.HELD })
      ]);

      await expect(
        service.createSessionHold("session-001", {
          seats: [{ sector: "A", row: "A", number: 1 }]
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("hold em assento ja vendido (SOLD)", () => {
    it("deve rejeitar hold quando assento esta SOLD", async () => {
      txClient.session.findFirst.mockResolvedValue(buildMockSession());
      txClient.sessionSeat.findMany.mockResolvedValue([
        buildMockSeat({ status: SessionSeatStatus.SOLD })
      ]);

      await expect(
        service.createSessionHold("session-001", {
          seats: [{ sector: "A", row: "A", number: 1 }]
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("hold em assento bloqueado (BLOCKED)", () => {
    it("deve rejeitar hold quando assento esta BLOCKED", async () => {
      txClient.session.findFirst.mockResolvedValue(buildMockSession());
      txClient.sessionSeat.findMany.mockResolvedValue([
        buildMockSeat({ status: SessionSeatStatus.BLOCKED })
      ]);

      await expect(
        service.createSessionHold("session-001", {
          seats: [{ sector: "A", row: "A", number: 1 }]
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("race condition - contagem de update diverge", () => {
    it("deve rejeitar quando updateMany retorna count menor que o solicitado", async () => {
      const seat = buildMockSeat({ status: SessionSeatStatus.AVAILABLE });
      txClient.session.findFirst.mockResolvedValue(buildMockSession());
      txClient.sessionSeat.findMany.mockResolvedValue([seat]);
      txClient.sessionHold.create.mockResolvedValue({
        id: "hold-001",
        tenantId: "tenant-001",
        sessionId: "session-001",
        status: SessionHoldStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 600_000)
      });
      txClient.sessionHoldSeat.createMany.mockResolvedValue({ count: 1 });

      // Simula race condition: outro processo atualizou o assento antes
      txClient.sessionSeat.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.createSessionHold("session-001", {
          seats: [{ sector: "A", row: "A", number: 1 }]
        })
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createSessionHold("session-001", {
          seats: [{ sector: "A", row: "A", number: 1 }]
        })
      ).rejects.toThrow("Conflito de concorrencia ao reservar assentos");
    });
  });

  describe("erro de serializacao Prisma (P2034)", () => {
    it("deve converter P2034 em ConflictException", async () => {
      const prismaError = new Error("Transaction failed") as Error & {
        code: string;
        meta?: Record<string, unknown>;
      };
      prismaError.code = "P2034";

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(prismaError);

      await expect(
        service.createSessionHold("session-001", {
          seats: [{ sector: "A", row: "A", number: 1 }]
        })
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createSessionHold("session-001", {
          seats: [{ sector: "A", row: "A", number: 1 }]
        })
      ).rejects.toThrow("Conflito de concorrencia ao reservar assentos");
    });
  });

  describe("sessao inexistente ou indisponivel", () => {
    it("deve rejeitar hold quando sessao nao existe", async () => {
      txClient.session.findFirst.mockResolvedValue(null);

      await expect(
        service.createSessionHold("session-inexistente", {
          seats: [{ sector: "A", row: "A", number: 1 }]
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("hold bem-sucedido em assento disponivel", () => {
    it("deve criar hold quando assento esta AVAILABLE e nao ha conflito", async () => {
      const seat = buildMockSeat({ status: SessionSeatStatus.AVAILABLE });
      txClient.session.findFirst.mockResolvedValue(buildMockSession());
      txClient.sessionSeat.findMany.mockResolvedValue([seat]);
      txClient.sessionHold.create.mockResolvedValue({
        id: "hold-001",
        tenantId: "tenant-001",
        sessionId: "session-001",
        status: SessionHoldStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 600_000)
      });
      txClient.sessionHoldSeat.createMany.mockResolvedValue({ count: 1 });
      txClient.sessionSeat.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.createSessionHold("session-001", {
        seats: [{ sector: "A", row: "A", number: 1 }]
      });

      expect(result.holdId).toBe("hold-001");
      expect(result.status).toBe(SessionHoldStatus.ACTIVE);
      expect(result.seats).toHaveLength(1);
      expect(txClient.sessionSeat.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: SessionSeatStatus.HELD }
        })
      );
    });
  });
});
