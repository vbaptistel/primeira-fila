import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import { EventsService } from "./events.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CommercialPoliciesService } from "../commercial-policies/commercial-policies.service";
import {
  EventDayStatus,
  EventStatus,
  SessionSeatStatus,
  SessionStatus
} from "../../generated/prisma/client";

function buildMockPrisma() {
  return {
    event: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    eventDay: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    session: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    sessionSeat: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txClient = {
        sessionHold: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 })
        },
        sessionHoldSeat: {
          findMany: vi.fn().mockResolvedValue([])
        },
        sessionSeat: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 })
        }
      };
      return fn(txClient);
    })
  } as unknown as PrismaService;
}

function buildMockCommercialPoliciesService() {
  return {
    ensureDefaultPolicy: vi.fn().mockResolvedValue({ id: "policy-001" })
  } as unknown as CommercialPoliciesService;
}

function buildMockEvent(overrides?: Partial<{
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: EventStatus;
}>) {
  return {
    id: overrides?.id ?? "event-001",
    tenantId: overrides?.tenantId ?? "tenant-001",
    name: overrides?.name ?? "Festival de Verao",
    slug: overrides?.slug ?? "festival-verao",
    description: "Evento de teste",
    timezone: "America/Sao_Paulo",
    status: overrides?.status ?? EventStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
    eventDays: []
  };
}

function buildMockEventDay(overrides?: Partial<{
  id: string;
  tenantId: string;
  eventId: string;
}>) {
  return {
    id: overrides?.id ?? "day-001",
    tenantId: overrides?.tenantId ?? "tenant-001",
    eventId: overrides?.eventId ?? "event-001",
    date: new Date("2026-06-15T00:00:00.000Z"),
    status: EventDayStatus.ACTIVE,
    sessions: []
  };
}

function buildMockSession(overrides?: Partial<{
  id: string;
  tenantId: string;
  eventId: string;
  eventDayId: string;
  startsAt: Date;
  endsAt: Date;
  salesStartsAt: Date | null;
  salesEndsAt: Date | null;
}>) {
  return {
    id: overrides?.id ?? "session-001",
    tenantId: overrides?.tenantId ?? "tenant-001",
    eventId: overrides?.eventId ?? "event-001",
    eventDayId: overrides?.eventDayId ?? "day-001",
    name: "Sessao Tarde",
    startsAt: overrides?.startsAt ?? new Date("2026-06-15T14:00:00Z"),
    endsAt: overrides?.endsAt ?? new Date("2026-06-15T18:00:00Z"),
    salesStartsAt: overrides?.salesStartsAt ?? null,
    salesEndsAt: overrides?.salesEndsAt ?? null,
    priceCents: 5000,
    currencyCode: "BRL",
    capacity: 100,
    status: SessionStatus.DRAFT
  };
}

describe("EventsService", () => {
  let service: EventsService;
  let prisma: PrismaService;
  let commercialPoliciesService: CommercialPoliciesService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    commercialPoliciesService = buildMockCommercialPoliciesService();
    service = new EventsService(prisma, commercialPoliciesService);
  });

  // ─── Eventos ────────────────────────────────────────────────────

  describe("createEvent", () => {
    it("deve criar evento com sucesso e garantir politica default", async () => {
      const created = buildMockEvent();
      vi.mocked(prisma.event.create).mockResolvedValue(created as never);

      const result = await service.createEvent("tenant-001", {
        name: "Festival de Verao",
        slug: "festival-verao",
        timezone: "America/Sao_Paulo"
      });

      expect(result).toEqual(created);
      expect(commercialPoliciesService.ensureDefaultPolicy).toHaveBeenCalledWith("tenant-001");
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-001",
          name: "Festival de Verao",
          slug: "festival-verao",
          status: EventStatus.DRAFT
        })
      });
    });

    it("deve usar status fornecido no DTO", async () => {
      const created = buildMockEvent({ status: EventStatus.PUBLISHED });
      vi.mocked(prisma.event.create).mockResolvedValue(created as never);

      await service.createEvent("tenant-001", {
        name: "Evento",
        slug: "evento",
        timezone: "America/Sao_Paulo",
        status: EventStatus.PUBLISHED
      });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: EventStatus.PUBLISHED
        })
      });
    });

    it("deve lancar ConflictException para slug duplicado (P2002)", async () => {
      const prismaError = new Error("Unique constraint") as Error & { code: string };
      prismaError.code = "P2002";
      vi.mocked(prisma.event.create).mockRejectedValue(prismaError);

      await expect(
        service.createEvent("tenant-001", {
          name: "Evento",
          slug: "slug-duplicado",
          timezone: "America/Sao_Paulo"
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("listTenantEvents", () => {
    it("deve listar eventos do tenant", async () => {
      const events = [buildMockEvent()];
      vi.mocked(prisma.event.findMany).mockResolvedValue(events as never);

      const result = await service.listTenantEvents("tenant-001");

      expect(result).toEqual(events);
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-001" }
        })
      );
    });
  });

  describe("getTenantEvent", () => {
    it("deve retornar evento do tenant", async () => {
      const event = buildMockEvent();
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);

      const result = await service.getTenantEvent("tenant-001", "event-001");

      expect(result).toEqual(event);
    });

    it("deve lancar NotFoundException quando evento nao encontrado", async () => {
      vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

      await expect(
        service.getTenantEvent("tenant-001", "event-inexistente")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateEvent", () => {
    it("deve atualizar evento com sucesso", async () => {
      const event = buildMockEvent();
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);
      vi.mocked(prisma.event.update).mockResolvedValue({ ...event, name: "Atualizado" } as never);

      const result = await service.updateEvent("tenant-001", "event-001", {
        name: "Atualizado"
      });

      expect(result.name).toBe("Atualizado");
    });

    it("deve lancar NotFoundException quando escopo invalido", async () => {
      vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

      await expect(
        service.updateEvent("tenant-001", "event-inexistente", { name: "X" })
      ).rejects.toThrow(NotFoundException);
    });

    it("deve lancar ConflictException para slug duplicado na atualizacao (P2002)", async () => {
      const event = buildMockEvent();
      const prismaError = new Error("Unique constraint") as Error & { code: string };
      prismaError.code = "P2002";
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);
      vi.mocked(prisma.event.update).mockRejectedValue(prismaError);

      await expect(
        service.updateEvent("tenant-001", "event-001", { slug: "slug-duplicado" })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("deleteEvent", () => {
    it("deve deletar evento com sucesso", async () => {
      const event = buildMockEvent();
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);
      vi.mocked(prisma.event.delete).mockResolvedValue(event as never);

      await service.deleteEvent("tenant-001", "event-001");

      expect(prisma.event.delete).toHaveBeenCalledWith({
        where: { id: "event-001" }
      });
    });
  });

  // ─── Event Days ─────────────────────────────────────────────────

  describe("createEventDay", () => {
    it("deve criar dia do evento com sucesso", async () => {
      const event = buildMockEvent();
      const day = buildMockEventDay();
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);
      vi.mocked(prisma.eventDay.create).mockResolvedValue(day as never);

      const result = await service.createEventDay("tenant-001", "event-001", {
        date: "2026-06-15"
      });

      expect(result).toEqual(day);
    });

    it("deve lancar ConflictException para data duplicada (P2002)", async () => {
      const event = buildMockEvent();
      const prismaError = new Error("Unique constraint") as Error & { code: string };
      prismaError.code = "P2002";
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);
      vi.mocked(prisma.eventDay.create).mockRejectedValue(prismaError);

      await expect(
        service.createEventDay("tenant-001", "event-001", { date: "2026-06-15" })
      ).rejects.toThrow(ConflictException);
    });

    it("deve lancar BadRequestException para data invalida", async () => {
      const event = buildMockEvent();
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);

      await expect(
        service.createEventDay("tenant-001", "event-001", { date: "data-invalida" })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getEventDay", () => {
    it("deve retornar dia do evento", async () => {
      const day = buildMockEventDay();
      vi.mocked(prisma.eventDay.findFirst).mockResolvedValue(day as never);

      const result = await service.getEventDay("tenant-001", "event-001", "day-001");

      expect(result).toEqual(day);
    });

    it("deve lancar NotFoundException quando dia nao encontrado", async () => {
      vi.mocked(prisma.eventDay.findFirst).mockResolvedValue(null);

      await expect(
        service.getEventDay("tenant-001", "event-001", "day-inexistente")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateEventDay", () => {
    it("deve atualizar dia do evento com sucesso", async () => {
      const day = buildMockEventDay();
      vi.mocked(prisma.eventDay.findFirst).mockResolvedValue(day as never);
      vi.mocked(prisma.eventDay.update).mockResolvedValue({
        ...day,
        status: EventDayStatus.CANCELLED
      } as never);

      const result = await service.updateEventDay("tenant-001", "event-001", "day-001", {
        status: EventDayStatus.CANCELLED
      });

      expect(result.status).toBe(EventDayStatus.CANCELLED);
    });
  });

  describe("deleteEventDay", () => {
    it("deve deletar dia do evento com sucesso", async () => {
      const day = buildMockEventDay();
      vi.mocked(prisma.eventDay.findFirst).mockResolvedValue(day as never);
      vi.mocked(prisma.eventDay.delete).mockResolvedValue(day as never);

      await service.deleteEventDay("tenant-001", "event-001", "day-001");

      expect(prisma.eventDay.delete).toHaveBeenCalledWith({
        where: { id: "day-001" }
      });
    });
  });

  // ─── Sessions ───────────────────────────────────────────────────

  describe("createSession", () => {
    it("deve criar sessao com timeline valida", async () => {
      const day = buildMockEventDay();
      const session = buildMockSession();
      vi.mocked(prisma.eventDay.findFirst).mockResolvedValue(day as never);
      vi.mocked(prisma.session.create).mockResolvedValue(session as never);

      const result = await service.createSession("tenant-001", "event-001", "day-001", {
        name: "Sessao Tarde",
        startsAt: "2026-06-15T14:00:00Z",
        endsAt: "2026-06-15T18:00:00Z",
        priceCents: 5000,
        currencyCode: "BRL",
        capacity: 100
      });

      expect(result).toEqual(session);
    });

    it("deve rejeitar sessao com endsAt <= startsAt", async () => {
      const day = buildMockEventDay();
      vi.mocked(prisma.eventDay.findFirst).mockResolvedValue(day as never);

      await expect(
        service.createSession("tenant-001", "event-001", "day-001", {
          name: "Sessao",
          startsAt: "2026-06-15T18:00:00Z",
          endsAt: "2026-06-15T14:00:00Z",
          priceCents: 5000,
          currencyCode: "BRL",
          capacity: 100
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createSession("tenant-001", "event-001", "day-001", {
          name: "Sessao",
          startsAt: "2026-06-15T18:00:00Z",
          endsAt: "2026-06-15T14:00:00Z",
          priceCents: 5000,
          currencyCode: "BRL",
          capacity: 100
        })
      ).rejects.toThrow("Fim da sessao deve ser posterior ao inicio.");
    });

    it("deve rejeitar sessao com salesStartsAt >= startsAt", async () => {
      const day = buildMockEventDay();
      vi.mocked(prisma.eventDay.findFirst).mockResolvedValue(day as never);

      await expect(
        service.createSession("tenant-001", "event-001", "day-001", {
          name: "Sessao",
          startsAt: "2026-06-15T14:00:00Z",
          endsAt: "2026-06-15T18:00:00Z",
          salesStartsAt: "2026-06-15T14:00:00Z",
          priceCents: 5000,
          currencyCode: "BRL",
          capacity: 100
        })
      ).rejects.toThrow("Inicio de vendas deve ser anterior ao inicio da sessao.");
    });

    it("deve rejeitar sessao com salesEndsAt > startsAt", async () => {
      const day = buildMockEventDay();
      vi.mocked(prisma.eventDay.findFirst).mockResolvedValue(day as never);

      await expect(
        service.createSession("tenant-001", "event-001", "day-001", {
          name: "Sessao",
          startsAt: "2026-06-15T14:00:00Z",
          endsAt: "2026-06-15T18:00:00Z",
          salesEndsAt: "2026-06-15T15:00:00Z",
          priceCents: 5000,
          currencyCode: "BRL",
          capacity: 100
        })
      ).rejects.toThrow("Fim de vendas nao pode ultrapassar inicio da sessao.");
    });

    it("deve rejeitar sessao com salesEndsAt <= salesStartsAt", async () => {
      const day = buildMockEventDay();
      vi.mocked(prisma.eventDay.findFirst).mockResolvedValue(day as never);

      await expect(
        service.createSession("tenant-001", "event-001", "day-001", {
          name: "Sessao",
          startsAt: "2026-06-15T14:00:00Z",
          endsAt: "2026-06-15T18:00:00Z",
          salesStartsAt: "2026-06-15T10:00:00Z",
          salesEndsAt: "2026-06-15T09:00:00Z",
          priceCents: 5000,
          currencyCode: "BRL",
          capacity: 100
        })
      ).rejects.toThrow("Fim de vendas deve ser posterior ao inicio de vendas.");
    });
  });

  describe("getSession", () => {
    it("deve retornar sessao valida", async () => {
      const session = buildMockSession();
      vi.mocked(prisma.session.findFirst).mockResolvedValue(session as never);

      const result = await service.getSession("tenant-001", "event-001", "day-001", "session-001");

      expect(result).toEqual(session);
    });

    it("deve lancar NotFoundException quando sessao nao encontrada", async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      await expect(
        service.getSession("tenant-001", "event-001", "day-001", "session-inexistente")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateSession", () => {
    it("deve atualizar sessao preservando timeline valida", async () => {
      const current = buildMockSession();
      const updated = { ...current, name: "Sessao Noite" };
      vi.mocked(prisma.session.findFirst).mockResolvedValue(current as never);
      vi.mocked(prisma.session.update).mockResolvedValue(updated as never);

      const result = await service.updateSession(
        "tenant-001", "event-001", "day-001", "session-001",
        { name: "Sessao Noite" }
      );

      expect(result.name).toBe("Sessao Noite");
    });

    it("deve rejeitar atualizacao que viola timeline", async () => {
      const current = buildMockSession();
      vi.mocked(prisma.session.findFirst).mockResolvedValue(current as never);

      await expect(
        service.updateSession(
          "tenant-001", "event-001", "day-001", "session-001",
          { endsAt: "2026-06-15T10:00:00Z" }
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("deleteSession", () => {
    it("deve deletar sessao com sucesso", async () => {
      const session = buildMockSession();
      vi.mocked(prisma.session.findFirst).mockResolvedValue(session as never);
      vi.mocked(prisma.session.delete).mockResolvedValue(session as never);

      await service.deleteSession("tenant-001", "event-001", "day-001", "session-001");

      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: "session-001" }
      });
    });
  });

  // ─── Seats ──────────────────────────────────────────────────────

  describe("createSessionSeat", () => {
    it("deve criar assento com sucesso", async () => {
      const session = buildMockSession();
      const seat = {
        id: "seat-001",
        tenantId: "tenant-001",
        sessionId: "session-001",
        sectorCode: "A",
        rowLabel: "1",
        seatNumber: 10,
        status: SessionSeatStatus.AVAILABLE
      };
      vi.mocked(prisma.session.findFirst).mockResolvedValue(session as never);
      vi.mocked(prisma.sessionSeat.create).mockResolvedValue(seat as never);

      const result = await service.createSessionSeat(
        "tenant-001", "event-001", "day-001", "session-001",
        { sectorCode: "A", rowLabel: "1", seatNumber: 10 }
      );

      expect(result).toEqual(seat);
    });

    it("deve lancar ConflictException para assento duplicado (P2002)", async () => {
      const session = buildMockSession();
      const prismaError = new Error("Unique constraint") as Error & { code: string };
      prismaError.code = "P2002";
      vi.mocked(prisma.session.findFirst).mockResolvedValue(session as never);
      vi.mocked(prisma.sessionSeat.create).mockRejectedValue(prismaError);

      await expect(
        service.createSessionSeat(
          "tenant-001", "event-001", "day-001", "session-001",
          { sectorCode: "A", rowLabel: "1", seatNumber: 10 }
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("updateSessionSeat", () => {
    it("deve atualizar status do assento com sucesso", async () => {
      const session = buildMockSession();
      const seat = {
        id: "seat-001",
        tenantId: "tenant-001",
        sessionId: "session-001",
        sectorCode: "A",
        rowLabel: "1",
        seatNumber: 10,
        status: SessionSeatStatus.BLOCKED
      };
      vi.mocked(prisma.session.findFirst).mockResolvedValue(session as never);
      vi.mocked(prisma.sessionSeat.findFirst).mockResolvedValue(seat as never);
      vi.mocked(prisma.sessionSeat.update).mockResolvedValue(seat as never);

      const result = await service.updateSessionSeat(
        "tenant-001", "event-001", "day-001", "session-001", "seat-001",
        { status: SessionSeatStatus.BLOCKED }
      );

      expect(result.status).toBe(SessionSeatStatus.BLOCKED);
    });

    it("deve lancar NotFoundException quando assento nao encontrado no escopo", async () => {
      const session = buildMockSession();
      vi.mocked(prisma.session.findFirst).mockResolvedValue(session as never);
      vi.mocked(prisma.sessionSeat.findFirst).mockResolvedValue(null);

      await expect(
        service.updateSessionSeat(
          "tenant-001", "event-001", "day-001", "session-001", "seat-inexistente",
          { status: SessionSeatStatus.BLOCKED }
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteSessionSeat", () => {
    it("deve deletar assento com sucesso", async () => {
      const session = buildMockSession();
      const seat = {
        id: "seat-001",
        tenantId: "tenant-001",
        sessionId: "session-001"
      };
      vi.mocked(prisma.session.findFirst).mockResolvedValue(session as never);
      vi.mocked(prisma.sessionSeat.findFirst).mockResolvedValue(seat as never);
      vi.mocked(prisma.sessionSeat.delete).mockResolvedValue(seat as never);

      await service.deleteSessionSeat(
        "tenant-001", "event-001", "day-001", "session-001", "seat-001"
      );

      expect(prisma.sessionSeat.delete).toHaveBeenCalledWith({
        where: { id: "seat-001" }
      });
    });
  });

  // ─── Endpoints publicos ─────────────────────────────────────────

  describe("listPublicEvents", () => {
    it("deve lancar NotFoundException quando tenantId nao fornecido", async () => {
      await expect(service.listPublicEvents(20)).rejects.toThrow(NotFoundException);
      await expect(service.listPublicEvents(20)).rejects.toThrow("Tenant nao resolvido.");
    });

    it("deve lancar NotFoundException quando tenantId undefined", async () => {
      await expect(service.listPublicEvents(20, undefined)).rejects.toThrow(NotFoundException);
    });

    it("deve lancar NotFoundException quando tenantId vazio", async () => {
      await expect(service.listPublicEvents(20, "")).rejects.toThrow(NotFoundException);
      await expect(service.listPublicEvents(20, "   ")).rejects.toThrow(NotFoundException);
    });

    it("deve listar eventos publicos com limite padrao", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      await service.listPublicEvents(20, "tenant-abc");

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          where: expect.objectContaining({
            tenantId: "tenant-abc"
          })
        })
      );
    });

    it("deve normalizar limite invalido para 20", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      await service.listPublicEvents(-5, "tenant-abc");

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20
        })
      );
    });

    it("deve limitar maximo a 100", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      await service.listPublicEvents(500, "tenant-abc");

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100
        })
      );
    });

    it("deve filtrar por tenantId quando fornecido", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      await service.listPublicEvents(20, "tenant-abc");

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "tenant-abc"
          })
        })
      );
    });
  });

  describe("getPublicEvent", () => {
    it("deve lancar NotFoundException quando tenantId nao fornecido", async () => {
      await expect(service.getPublicEvent("event-001")).rejects.toThrow(NotFoundException);
      await expect(service.getPublicEvent("event-001")).rejects.toThrow("Tenant nao resolvido.");
    });

    it("deve lancar NotFoundException quando tenantId undefined", async () => {
      await expect(service.getPublicEvent("event-001", undefined)).rejects.toThrow(NotFoundException);
    });

    it("deve retornar evento publico", async () => {
      const event = buildMockEvent({ status: EventStatus.PUBLISHED });
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);

      const result = await service.getPublicEvent("event-001", "tenant-abc");

      expect(result).toEqual(event);
    });

    it("deve lancar NotFoundException quando evento nao encontrado ou indisponivel", async () => {
      vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

      await expect(
        service.getPublicEvent("event-inexistente", "tenant-abc")
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPublicEvent("event-inexistente", "tenant-abc")
      ).rejects.toThrow("Evento nao encontrado ou indisponivel para publicacao.");
    });

    it("deve filtrar por tenantId quando fornecido", async () => {
      const event = buildMockEvent({ status: EventStatus.PUBLISHED });
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);

      await service.getPublicEvent("event-001", "tenant-abc");

      expect(prisma.event.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "event-001",
            tenantId: "tenant-abc"
          })
        })
      );
    });

    it("deve retornar 404 quando evento pertence a outro tenant", async () => {
      vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

      await expect(
        service.getPublicEvent("event-001", "tenant-outro")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getPublicSessionSeats", () => {
    it("deve retornar assentos de sessao publica", async () => {
      const session = buildMockSession();
      const seats = [
        { id: "seat-001", sectorCode: "A", rowLabel: "1", seatNumber: 1, status: SessionSeatStatus.AVAILABLE }
      ];
      vi.mocked(prisma.session.findFirst).mockResolvedValue(session as never);
      vi.mocked(prisma.sessionSeat.findMany).mockResolvedValue(seats as never);

      const result = await service.getPublicSessionSeats("session-001");

      expect(result).toEqual(seats);
    });

    it("deve lancar NotFoundException quando sessao nao publica", async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      await expect(
        service.getPublicSessionSeats("session-inexistente")
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Helpers ────────────────────────────────────────────────────

  describe("normalizeRequestedSeats (via createSessionHold)", () => {
    it("deve rejeitar assentos duplicados no payload", async () => {
      await expect(
        service.createSessionHold("session-001", {
          seats: [
            { sector: "A", row: "1", number: 10 },
            { sector: "a", row: "1", number: 10 }
          ]
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createSessionHold("session-001", {
          seats: [
            { sector: "A", row: "1", number: 10 },
            { sector: " a ", row: " 1 ", number: 10 }
          ]
        })
      ).rejects.toThrow("Assento duplicado no payload");
    });
  });

  describe("handleWriteError (P2003)", () => {
    it("deve lancar BadRequestException para erro de relacionamento (P2003)", async () => {
      const event = buildMockEvent();
      const prismaError = new Error("Foreign key constraint") as Error & { code: string };
      prismaError.code = "P2003";
      vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);
      vi.mocked(prisma.eventDay.create).mockRejectedValue(prismaError);

      await expect(
        service.createEventDay("tenant-001", "event-001", { date: "2026-06-15" })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createEventDay("tenant-001", "event-001", { date: "2026-06-15" })
      ).rejects.toThrow("Relacionamento invalido para a operacao solicitada.");
    });
  });
});
