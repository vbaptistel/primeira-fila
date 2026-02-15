import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  EventDayStatus,
  EventStatus,
  Prisma,
  SessionHoldStatus,
  SessionSeatStatus,
  SessionStatus
} from "../../generated/prisma/client";
import { CreateEventDayDto } from "./dto/create-event-day.dto";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateHoldDto } from "./dto/create-hold.dto";
import { CreateSessionDto } from "./dto/create-session.dto";
import { CreateSessionSeatDto } from "./dto/create-session-seat.dto";
import { UpdateEventDayDto } from "./dto/update-event-day.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateSessionDto } from "./dto/update-session.dto";
import { UpdateSessionSeatDto } from "./dto/update-session-seat.dto";
import { CommercialPoliciesService } from "../commercial-policies/commercial-policies.service";

type SessionTimeline = {
  startsAt: Date;
  endsAt: Date;
  salesStartsAt?: Date;
  salesEndsAt?: Date;
};

type RequestedSeat = {
  sector: string;
  row: string;
  number: number;
};

const HOLD_TTL_MINUTES = 10;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commercialPoliciesService: CommercialPoliciesService
  ) {}

  async createEvent(tenantId: string, dto: CreateEventDto) {
    await this.commercialPoliciesService.ensureDefaultPolicy(tenantId);

    try {
      return await this.prisma.event.create({
        data: {
          tenantId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          timezone: dto.timezone,
          status: dto.status ?? EventStatus.DRAFT
        }
      });
    } catch (error) {
      this.handleWriteError(error, "Ja existe evento com esse slug para o tenant informado.");
    }
  }

  async listTenantEvents(tenantId: string) {
    return this.prisma.event.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        eventDays: {
          orderBy: { date: "asc" },
          include: {
            sessions: {
              orderBy: { startsAt: "asc" }
            }
          }
        }
      }
    });
  }

  async getTenantEvent(tenantId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: {
        eventDays: {
          orderBy: { date: "asc" },
          include: {
            sessions: {
              orderBy: { startsAt: "asc" }
            }
          }
        }
      }
    });

    if (!event) {
      throw new NotFoundException("Evento nao encontrado para o tenant informado.");
    }

    return event;
  }

  async updateEvent(tenantId: string, eventId: string, dto: UpdateEventDto) {
    await this.ensureEventScope(tenantId, eventId);

    try {
      return await this.prisma.event.update({
        where: { id: eventId },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          timezone: dto.timezone,
          status: dto.status
        }
      });
    } catch (error) {
      this.handleWriteError(error, "Falha ao atualizar evento por conflito de dados.");
    }
  }

  async deleteEvent(tenantId: string, eventId: string) {
    await this.ensureEventScope(tenantId, eventId);
    await this.prisma.event.delete({
      where: { id: eventId }
    });
  }

  async createEventDay(tenantId: string, eventId: string, dto: CreateEventDayDto) {
    await this.ensureEventScope(tenantId, eventId);

    try {
      return await this.prisma.eventDay.create({
        data: {
          tenantId,
          eventId,
          date: this.toDateOnly(dto.date),
          status: dto.status ?? EventDayStatus.ACTIVE
        }
      });
    } catch (error) {
      this.handleWriteError(error, "Ja existe dia cadastrado para este evento nessa data.");
    }
  }

  async listEventDays(tenantId: string, eventId: string) {
    await this.ensureEventScope(tenantId, eventId);

    return this.prisma.eventDay.findMany({
      where: { tenantId, eventId },
      orderBy: { date: "asc" },
      include: {
        sessions: {
          orderBy: { startsAt: "asc" }
        }
      }
    });
  }

  async getEventDay(tenantId: string, eventId: string, eventDayId: string) {
    const eventDay = await this.prisma.eventDay.findFirst({
      where: {
        id: eventDayId,
        eventId,
        tenantId
      },
      include: {
        sessions: {
          orderBy: { startsAt: "asc" }
        }
      }
    });

    if (!eventDay) {
      throw new NotFoundException("Dia do evento nao encontrado para o escopo informado.");
    }

    return eventDay;
  }

  async updateEventDay(
    tenantId: string,
    eventId: string,
    eventDayId: string,
    dto: UpdateEventDayDto
  ) {
    await this.ensureEventDayScope(tenantId, eventId, eventDayId);

    try {
      return await this.prisma.eventDay.update({
        where: { id: eventDayId },
        data: {
          date: dto.date ? this.toDateOnly(dto.date) : undefined,
          status: dto.status
        }
      });
    } catch (error) {
      this.handleWriteError(error, "Falha ao atualizar dia do evento por conflito de dados.");
    }
  }

  async deleteEventDay(tenantId: string, eventId: string, eventDayId: string) {
    await this.ensureEventDayScope(tenantId, eventId, eventDayId);

    await this.prisma.eventDay.delete({
      where: { id: eventDayId }
    });
  }

  async createSession(
    tenantId: string,
    eventId: string,
    eventDayId: string,
    dto: CreateSessionDto
  ) {
    await this.ensureEventDayScope(tenantId, eventId, eventDayId);

    const timeline = this.buildTimeline(dto);
    this.assertSessionTimeline(timeline);

    try {
      return await this.prisma.session.create({
        data: {
          tenantId,
          eventId,
          eventDayId,
          name: dto.name,
          startsAt: timeline.startsAt,
          endsAt: timeline.endsAt,
          salesStartsAt: timeline.salesStartsAt,
          salesEndsAt: timeline.salesEndsAt,
          priceCents: dto.priceCents,
          currencyCode: dto.currencyCode,
          capacity: dto.capacity,
          status: dto.status ?? SessionStatus.DRAFT
        }
      });
    } catch (error) {
      this.handleWriteError(error, "Falha ao criar sessao: conflito de horario ou dados invalidos.");
    }
  }

  async listSessions(tenantId: string, eventId: string, eventDayId: string) {
    await this.ensureEventDayScope(tenantId, eventId, eventDayId);

    return this.prisma.session.findMany({
      where: {
        tenantId,
        eventId,
        eventDayId
      },
      orderBy: { startsAt: "asc" }
    });
  }

  async getSession(tenantId: string, eventId: string, eventDayId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        tenantId,
        eventId,
        eventDayId
      }
    });

    if (!session) {
      throw new NotFoundException("Sessao nao encontrada para o escopo informado.");
    }

    return session;
  }

  async updateSession(
    tenantId: string,
    eventId: string,
    eventDayId: string,
    sessionId: string,
    dto: UpdateSessionDto
  ) {
    const current = await this.getSession(tenantId, eventId, eventDayId, sessionId);

    const timeline = this.buildTimeline({
      startsAt: dto.startsAt ?? current.startsAt.toISOString(),
      endsAt: dto.endsAt ?? current.endsAt.toISOString(),
      salesStartsAt: dto.salesStartsAt ?? current.salesStartsAt?.toISOString(),
      salesEndsAt: dto.salesEndsAt ?? current.salesEndsAt?.toISOString()
    });

    this.assertSessionTimeline(timeline);

    try {
      return await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          name: dto.name,
          startsAt: dto.startsAt ? timeline.startsAt : undefined,
          endsAt: dto.endsAt ? timeline.endsAt : undefined,
          salesStartsAt: dto.salesStartsAt !== undefined ? timeline.salesStartsAt : undefined,
          salesEndsAt: dto.salesEndsAt !== undefined ? timeline.salesEndsAt : undefined,
          priceCents: dto.priceCents,
          currencyCode: dto.currencyCode,
          capacity: dto.capacity,
          status: dto.status
        }
      });
    } catch (error) {
      this.handleWriteError(error, "Falha ao atualizar sessao: conflito de horario ou dados invalidos.");
    }
  }

  async deleteSession(tenantId: string, eventId: string, eventDayId: string, sessionId: string) {
    await this.getSession(tenantId, eventId, eventDayId, sessionId);

    await this.prisma.session.delete({
      where: { id: sessionId }
    });
  }

  async createSessionSeat(
    tenantId: string,
    eventId: string,
    eventDayId: string,
    sessionId: string,
    dto: CreateSessionSeatDto
  ) {
    await this.getSession(tenantId, eventId, eventDayId, sessionId);

    try {
      return await this.prisma.sessionSeat.create({
        data: {
          tenantId,
          sessionId,
          sectorCode: dto.sectorCode,
          rowLabel: dto.rowLabel,
          seatNumber: dto.seatNumber,
          status: dto.status ?? SessionSeatStatus.AVAILABLE
        }
      });
    } catch (error) {
      this.handleWriteError(
        error,
        "Assento ja cadastrado para esta sessao com o mesmo setor, fileira e numero."
      );
    }
  }

  async listSessionSeats(
    tenantId: string,
    eventId: string,
    eventDayId: string,
    sessionId: string
  ) {
    await this.getSession(tenantId, eventId, eventDayId, sessionId);
    await this.expireSessionHolds(sessionId);

    return this.prisma.sessionSeat.findMany({
      where: {
        tenantId,
        sessionId
      },
      orderBy: [{ sectorCode: "asc" }, { rowLabel: "asc" }, { seatNumber: "asc" }]
    });
  }

  async updateSessionSeat(
    tenantId: string,
    eventId: string,
    eventDayId: string,
    sessionId: string,
    seatId: string,
    dto: UpdateSessionSeatDto
  ) {
    await this.getSession(tenantId, eventId, eventDayId, sessionId);
    await this.ensureSessionSeatScope(tenantId, sessionId, seatId);

    try {
      return await this.prisma.sessionSeat.update({
        where: { id: seatId },
        data: {
          status: dto.status
        }
      });
    } catch (error) {
      this.handleWriteError(error, "Falha ao atualizar status do assento.");
    }
  }

  async deleteSessionSeat(
    tenantId: string,
    eventId: string,
    eventDayId: string,
    sessionId: string,
    seatId: string
  ) {
    await this.getSession(tenantId, eventId, eventDayId, sessionId);
    await this.ensureSessionSeatScope(tenantId, sessionId, seatId);

    await this.prisma.sessionSeat.delete({
      where: { id: seatId }
    });
  }

  async listPublicEvents(limit = 20) {
    const safeLimit = this.normalizeLimit(limit);

    return this.prisma.event.findMany({
      where: {
        status: {
          not: EventStatus.ARCHIVED
        },
        sessions: {
          some: {
            status: SessionStatus.PUBLISHED
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: safeLimit,
      include: {
        eventDays: {
          where: {
            sessions: {
              some: {
                status: SessionStatus.PUBLISHED
              }
            }
          },
          orderBy: {
            date: "asc"
          },
          include: {
            sessions: {
              where: {
                status: SessionStatus.PUBLISHED
              },
              orderBy: {
                startsAt: "asc"
              }
            }
          }
        }
      }
    });
  }

  async getPublicEvent(eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: {
          not: EventStatus.ARCHIVED
        },
        sessions: {
          some: {
            status: SessionStatus.PUBLISHED
          }
        }
      },
      include: {
        eventDays: {
          where: {
            sessions: {
              some: {
                status: SessionStatus.PUBLISHED
              }
            }
          },
          orderBy: {
            date: "asc"
          },
          include: {
            sessions: {
              where: {
                status: SessionStatus.PUBLISHED
              },
              orderBy: {
                startsAt: "asc"
              }
            }
          }
        }
      }
    });

    if (!event) {
      throw new NotFoundException("Evento nao encontrado ou indisponivel para publicacao.");
    }

    return event;
  }

  async createSessionHold(sessionId: string, dto: CreateHoldDto) {
    const requestedSeats = this.normalizeRequestedSeats(dto);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60 * 1000);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const session = await tx.session.findFirst({
            where: {
              id: sessionId,
              status: SessionStatus.PUBLISHED,
              event: {
                status: {
                  not: EventStatus.ARCHIVED
                }
              }
            },
            select: {
              id: true,
              tenantId: true
            }
          });

          if (!session) {
            throw new NotFoundException("Sessao nao encontrada ou indisponivel para publicacao.");
          }

          await this.expireSessionHoldsInTx(tx, sessionId, now);

          const seatScope = requestedSeats.map((seat) => ({
            sectorCode: seat.sector,
            rowLabel: seat.row,
            seatNumber: seat.number
          }));

          const seats = await tx.sessionSeat.findMany({
            where: {
              sessionId,
              OR: seatScope
            }
          });

          const seatByKey = new Map(
            seats.map((seat) => [
              this.buildSeatKey(seat.sectorCode, seat.rowLabel, seat.seatNumber),
              seat
            ])
          );

          const resolvedSeats = requestedSeats.map((requestedSeat) => {
            const key = this.buildSeatKey(requestedSeat.sector, requestedSeat.row, requestedSeat.number);
            const seat = seatByKey.get(key);

            if (!seat) {
              throw new ConflictException(
                `Assento ${this.describeSeat(requestedSeat.sector, requestedSeat.row, requestedSeat.number)} nao existe nesta sessao.`
              );
            }

            return seat;
          });

          const unavailableSeat = resolvedSeats.find(
            (seat) => seat.status !== SessionSeatStatus.AVAILABLE
          );
          if (unavailableSeat) {
            throw new ConflictException(
              `Assento ${this.describeSeat(unavailableSeat.sectorCode, unavailableSeat.rowLabel, unavailableSeat.seatNumber)} nao esta disponivel para hold.`
            );
          }

          const hold = await tx.sessionHold.create({
            data: {
              tenantId: session.tenantId,
              sessionId,
              status: SessionHoldStatus.ACTIVE,
              expiresAt
            }
          });

          await tx.sessionHoldSeat.createMany({
            data: resolvedSeats.map((seat) => ({
              holdId: hold.id,
              seatId: seat.id
            }))
          });

          const updatedSeats = await tx.sessionSeat.updateMany({
            where: {
              id: {
                in: resolvedSeats.map((seat) => seat.id)
              },
              status: SessionSeatStatus.AVAILABLE
            },
            data: {
              status: SessionSeatStatus.HELD
            }
          });

          if (updatedSeats.count !== resolvedSeats.length) {
            throw new ConflictException("Conflito de concorrencia ao reservar assentos.");
          }

          return {
            holdId: hold.id,
            sessionId: hold.sessionId,
            status: hold.status,
            expiresAt: hold.expiresAt,
            seats: resolvedSeats.map((seat) => ({
              seatId: seat.id,
              sectorCode: seat.sectorCode,
              rowLabel: seat.rowLabel,
              seatNumber: seat.seatNumber
            }))
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      if (this.isPrismaErrorCode(error, "P2034")) {
        throw new ConflictException("Conflito de concorrencia ao reservar assentos.");
      }

      throw error;
    }
  }

  async getPublicSessionSeats(sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        status: SessionStatus.PUBLISHED,
        event: {
          status: {
            not: EventStatus.ARCHIVED
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Sessao nao encontrada ou indisponivel para publicacao.");
    }

    await this.expireSessionHolds(sessionId);

    return this.prisma.sessionSeat.findMany({
      where: {
        sessionId
      },
      orderBy: [{ sectorCode: "asc" }, { rowLabel: "asc" }, { seatNumber: "asc" }]
    });
  }

  private async ensureEventScope(tenantId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        tenantId
      }
    });

    if (!event) {
      throw new NotFoundException("Evento nao encontrado para o tenant informado.");
    }

    return event;
  }

  private async ensureEventDayScope(tenantId: string, eventId: string, eventDayId: string) {
    const eventDay = await this.prisma.eventDay.findFirst({
      where: {
        id: eventDayId,
        eventId,
        tenantId
      }
    });

    if (!eventDay) {
      throw new NotFoundException("Dia do evento nao encontrado para o escopo informado.");
    }

    return eventDay;
  }

  private async ensureSessionSeatScope(tenantId: string, sessionId: string, seatId: string) {
    const seat = await this.prisma.sessionSeat.findFirst({
      where: {
        id: seatId,
        tenantId,
        sessionId
      }
    });

    if (!seat) {
      throw new NotFoundException("Assento nao encontrado para o escopo informado.");
    }

    return seat;
  }

  private toDateOnly(date: string): Date {
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : date;
    const parsed = new Date(normalized);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Data invalida para dia do evento.");
    }

    return parsed;
  }

  private toDateTime(value: string | undefined): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Data/hora invalida para sessao.");
    }

    return parsed;
  }

  private buildTimeline(input: {
    startsAt: string;
    endsAt: string;
    salesStartsAt?: string;
    salesEndsAt?: string;
  }): SessionTimeline {
    return {
      startsAt: this.toDateTime(input.startsAt) as Date,
      endsAt: this.toDateTime(input.endsAt) as Date,
      salesStartsAt: this.toDateTime(input.salesStartsAt),
      salesEndsAt: this.toDateTime(input.salesEndsAt)
    };
  }

  private assertSessionTimeline(timeline: SessionTimeline) {
    if (timeline.endsAt <= timeline.startsAt) {
      throw new BadRequestException("Fim da sessao deve ser posterior ao inicio.");
    }

    if (timeline.salesStartsAt && timeline.salesStartsAt >= timeline.startsAt) {
      throw new BadRequestException("Inicio de vendas deve ser anterior ao inicio da sessao.");
    }

    if (timeline.salesEndsAt && timeline.salesEndsAt > timeline.startsAt) {
      throw new BadRequestException("Fim de vendas nao pode ultrapassar inicio da sessao.");
    }

    if (
      timeline.salesStartsAt &&
      timeline.salesEndsAt &&
      timeline.salesEndsAt <= timeline.salesStartsAt
    ) {
      throw new BadRequestException("Fim de vendas deve ser posterior ao inicio de vendas.");
    }
  }

  private normalizeRequestedSeats(dto: CreateHoldDto): RequestedSeat[] {
    const seatsByKey = new Map<string, RequestedSeat>();

    for (const seat of dto.seats) {
      const normalizedSeat = {
        sector: seat.sector.trim().toUpperCase(),
        row: seat.row.trim().toUpperCase(),
        number: seat.number
      };
      const key = this.buildSeatKey(normalizedSeat.sector, normalizedSeat.row, normalizedSeat.number);

      if (seatsByKey.has(key)) {
        throw new BadRequestException(
          `Assento duplicado no payload: ${this.describeSeat(normalizedSeat.sector, normalizedSeat.row, normalizedSeat.number)}.`
        );
      }

      seatsByKey.set(key, normalizedSeat);
    }

    return Array.from(seatsByKey.values());
  }

  private async expireSessionHolds(sessionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.expireSessionHoldsInTx(tx, sessionId, new Date());
    });
  }

  private async expireSessionHoldsInTx(
    tx: Prisma.TransactionClient,
    sessionId: string,
    now: Date
  ): Promise<void> {
    const expiredHolds = await tx.sessionHold.findMany({
      where: {
        sessionId,
        status: SessionHoldStatus.ACTIVE,
        expiresAt: {
          lte: now
        }
      },
      select: {
        id: true
      }
    });

    if (!expiredHolds.length) {
      return;
    }

    const holdIds = expiredHolds.map((hold) => hold.id);

    await tx.sessionHold.updateMany({
      where: {
        id: {
          in: holdIds
        },
        status: SessionHoldStatus.ACTIVE
      },
      data: {
        status: SessionHoldStatus.EXPIRED
      }
    });

    const holdSeats = await tx.sessionHoldSeat.findMany({
      where: {
        holdId: {
          in: holdIds
        }
      },
      select: {
        seatId: true
      },
      distinct: ["seatId"]
    });

    if (!holdSeats.length) {
      return;
    }

    await tx.sessionSeat.updateMany({
      where: {
        id: {
          in: holdSeats.map((holdSeat) => holdSeat.seatId)
        },
        sessionId,
        status: SessionSeatStatus.HELD,
        holdSeats: {
          none: {
            hold: {
              status: SessionHoldStatus.ACTIVE
            }
          }
        }
      },
      data: {
        status: SessionSeatStatus.AVAILABLE
      }
    });
  }

  private buildSeatKey(sectorCode: string, rowLabel: string, seatNumber: number): string {
    return `${sectorCode}::${rowLabel}::${seatNumber}`;
  }

  private describeSeat(sectorCode: string, rowLabel: string, seatNumber: number): string {
    return `${sectorCode}-${rowLabel}-${seatNumber}`;
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit <= 0) {
      return 20;
    }

    return Math.min(limit, 100);
  }

  private handleWriteError(error: unknown, conflictMessage: string): never {
    if (this.isPrismaErrorCode(error, "P2002")) {
      throw new ConflictException(conflictMessage);
    }

    if (this.isPrismaErrorCode(error, "P2003")) {
      throw new BadRequestException("Relacionamento invalido para a operacao solicitada.");
    }

    throw error;
  }

  private isPrismaErrorCode(error: unknown, code: string): boolean {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    return "code" in error && (error as { code?: string }).code === code;
  }
}
