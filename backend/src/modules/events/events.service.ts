import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { EventDayStatus, EventStatus, SessionStatus } from "@prisma/client";
import { CreateEventDayDto } from "./dto/create-event-day.dto";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateSessionDto } from "./dto/create-session.dto";
import { UpdateEventDayDto } from "./dto/update-event-day.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateSessionDto } from "./dto/update-session.dto";

type SessionTimeline = {
  startsAt: Date;
  endsAt: Date;
  salesStartsAt?: Date;
  salesEndsAt?: Date;
};

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(tenantId: string, dto: CreateEventDto) {
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
