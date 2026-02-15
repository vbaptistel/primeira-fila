import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConflictException,
  GoneException,
  NotFoundException
} from "@nestjs/common";
import { CheckInService } from "./check-in.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { AuditAction, TicketStatus } from "../../generated/prisma/client";

function buildMockTicket(overrides?: Partial<{
  id: string;
  tenantId: string;
  qrCode: string;
  orderId: string;
  sessionId: string;
  seatId: string;
  status: TicketStatus;
}>) {
  return {
    id: overrides?.id ?? "ticket-001",
    tenantId: overrides?.tenantId ?? "tenant-001",
    qrCode: overrides?.qrCode ?? "qr-abc-123",
    orderId: overrides?.orderId ?? "order-001",
    sessionId: overrides?.sessionId ?? "session-001",
    seatId: overrides?.seatId ?? "seat-001",
    status: overrides?.status ?? TicketStatus.VALID,
    seat: {
      id: "seat-001",
      sectorCode: "A",
      rowLabel: "1",
      seatNumber: 10
    },
    session: {
      id: "session-001",
      name: "Sessao Tarde",
      startsAt: new Date("2026-06-01T14:00:00Z"),
      endsAt: new Date("2026-06-01T18:00:00Z")
    },
    order: {
      id: "order-001",
      buyerName: "Maria Silva",
      buyerEmail: "maria@email.com"
    }
  };
}

function buildMockPrisma() {
  return {
    ticket: {
      findUnique: vi.fn(),
      updateMany: vi.fn()
    }
  } as unknown as PrismaService;
}

function buildMockAuditService() {
  return {
    log: vi.fn().mockResolvedValue(undefined)
  } as unknown as AuditService;
}

describe("CheckInService", () => {
  let service: CheckInService;
  let prisma: PrismaService;
  let auditService: AuditService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    auditService = buildMockAuditService();
    service = new CheckInService(prisma, auditService);
  });

  describe("validateCheckIn", () => {
    it("deve lancar NotFoundException quando ticket nao encontrado pelo QR", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue(null);

      await expect(service.validateCheckIn("qr-inexistente")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.validateCheckIn("qr-inexistente")).rejects.toThrow(
        "Ticket nao encontrado para o QR informado."
      );
    });

    it("deve lancar ConflictException quando ticket ja utilizado (USED)", async () => {
      const ticket = buildMockTicket({ status: TicketStatus.USED });
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket as never);

      await expect(service.validateCheckIn("qr-abc-123")).rejects.toThrow(
        ConflictException
      );
      await expect(service.validateCheckIn("qr-abc-123")).rejects.toThrow(
        "Ticket ja utilizado. Check-in negado."
      );
    });

    it("deve lancar GoneException quando ticket cancelado (CANCELLED)", async () => {
      const ticket = buildMockTicket({ status: TicketStatus.CANCELLED });
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket as never);

      await expect(service.validateCheckIn("qr-abc-123")).rejects.toThrow(
        GoneException
      );
      await expect(service.validateCheckIn("qr-abc-123")).rejects.toThrow(
        "Ticket cancelado. Check-in negado."
      );
    });

    it("deve lancar ConflictException quando updateMany retorna count 0 (race condition)", async () => {
      const ticket = buildMockTicket({ status: TicketStatus.VALID });
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket as never);
      vi.mocked(prisma.ticket.updateMany).mockResolvedValue({ count: 0 } as never);

      await expect(service.validateCheckIn("qr-abc-123")).rejects.toThrow(
        ConflictException
      );
      await expect(service.validateCheckIn("qr-abc-123")).rejects.toThrow(
        "Ticket ja utilizado ou cancelado. Check-in negado."
      );
    });

    it("deve realizar check-in com sucesso quando ticket VALID", async () => {
      const ticket = buildMockTicket({ status: TicketStatus.VALID });
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket as never);
      vi.mocked(prisma.ticket.updateMany).mockResolvedValue({ count: 1 } as never);

      const result = await service.validateCheckIn("qr-abc-123");

      expect(result.ticketId).toBe("ticket-001");
      expect(result.status).toBe(TicketStatus.USED);
      expect(result.seat).toEqual(ticket.seat);
      expect(result.session).toEqual(ticket.session);
      expect(result.order).toEqual(ticket.order);
    });

    it("deve registrar audit log quando actorId fornecido", async () => {
      const ticket = buildMockTicket({ status: TicketStatus.VALID });
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket as never);
      vi.mocked(prisma.ticket.updateMany).mockResolvedValue({ count: 1 } as never);

      await service.validateCheckIn("qr-abc-123", "actor-001");

      expect(auditService.log).toHaveBeenCalledWith({
        tenantId: "tenant-001",
        actorId: "actor-001",
        action: AuditAction.CHECK_IN,
        resourceType: "ticket",
        resourceId: "ticket-001",
        metadata: {
          qrCode: "qr-abc-123",
          orderId: "order-001",
          sessionId: "session-001",
          seatId: "seat-001"
        }
      });
    });

    it("nao deve registrar audit log quando actorId nao fornecido", async () => {
      const ticket = buildMockTicket({ status: TicketStatus.VALID });
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket as never);
      vi.mocked(prisma.ticket.updateMany).mockResolvedValue({ count: 1 } as never);

      await service.validateCheckIn("qr-abc-123");

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it("deve chamar updateMany com filtro de status VALID para proteger contra race condition", async () => {
      const ticket = buildMockTicket({ status: TicketStatus.VALID });
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue(ticket as never);
      vi.mocked(prisma.ticket.updateMany).mockResolvedValue({ count: 1 } as never);

      await service.validateCheckIn("qr-abc-123");

      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        where: {
          id: "ticket-001",
          status: TicketStatus.VALID
        },
        data: {
          status: TicketStatus.USED,
          usedAt: expect.any(Date)
        }
      });
    });
  });
});
