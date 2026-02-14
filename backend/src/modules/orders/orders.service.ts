import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  EventStatus,
  OrderStatus,
  Prisma,
  SessionHoldStatus,
  SessionSeatStatus,
  SessionStatus
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";

const DEFAULT_COMMERCIAL_POLICY_VERSION = "platform_default_v1";
const DEFAULT_SERVICE_FEE_PERCENT = 0.1;
const DEFAULT_SERVICE_FEE_FIXED_CENTS = 200;
const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(idempotencyKeyHeader: string | undefined, dto: CreateOrderDto) {
    const idempotencyKey = this.normalizeIdempotencyKey(idempotencyKeyHeader);
    const requestHash = this.buildRequestHash(dto);

    const existingByIdempotency = await this.findOrderByIdempotencyKey(idempotencyKey);
    if (existingByIdempotency) {
      if (existingByIdempotency.requestHash !== requestHash) {
        throw new ConflictException("Idempotency-Key ja utilizada com payload diferente.");
      }

      return existingByIdempotency;
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const hold = await tx.sessionHold.findUnique({
            where: {
              id: dto.holdId
            },
            include: {
              session: {
                select: {
                  id: true,
                  tenantId: true,
                  priceCents: true,
                  currencyCode: true,
                  status: true,
                  event: {
                    select: {
                      status: true
                    }
                  }
                }
              },
              heldSeats: {
                include: {
                  seat: true
                }
              }
            }
          });

          if (!hold) {
            throw new NotFoundException("Hold nao encontrado.");
          }

          if (
            hold.session.status !== SessionStatus.PUBLISHED ||
            hold.session.event.status === EventStatus.ARCHIVED
          ) {
            throw new ConflictException("Sessao nao esta disponivel para compra.");
          }

          const existingByHold = await tx.order.findUnique({
            where: {
              holdId: hold.id
            },
            include: {
              items: {
                orderBy: {
                  createdAt: "asc"
                }
              }
            }
          });

          if (existingByHold) {
            throw new ConflictException("Hold ja utilizada para criacao de pedido.");
          }

          await this.expireHoldIfNeeded(tx, hold.id, hold.sessionId, hold.status, hold.expiresAt);

          if (hold.status !== SessionHoldStatus.ACTIVE) {
            if (hold.status === SessionHoldStatus.EXPIRED) {
              throw new GoneException("Hold expirada.");
            }

            throw new ConflictException("Hold indisponivel para criacao de pedido.");
          }

          if (!hold.heldSeats.length) {
            throw new ConflictException("Hold sem assentos reservados para conversao em pedido.");
          }

          const invalidSeat = hold.heldSeats.find(
            (holdSeat) => holdSeat.seat.status !== SessionSeatStatus.HELD
          );
          if (invalidSeat) {
            throw new ConflictException("Assentos da hold nao estao mais reservados.");
          }

          const ticketSubtotalCents = hold.heldSeats.length * hold.session.priceCents;
          const serviceFeeCents = Math.round(
            ticketSubtotalCents * DEFAULT_SERVICE_FEE_PERCENT + DEFAULT_SERVICE_FEE_FIXED_CENTS
          );
          const totalAmountCents = ticketSubtotalCents + serviceFeeCents;

          const createdOrder = await tx.order.create({
            data: {
              tenantId: hold.tenantId,
              sessionId: hold.sessionId,
              holdId: hold.id,
              idempotencyKey,
              requestHash,
              status: OrderStatus.PENDING_PAYMENT,
              buyerName: dto.buyer.name,
              buyerEmail: dto.buyer.email,
              buyerDocument: dto.buyer.document,
              currencyCode: hold.session.currencyCode,
              ticketSubtotalCents,
              serviceFeeCents,
              totalAmountCents,
              commercialPolicyVersion: DEFAULT_COMMERCIAL_POLICY_VERSION,
              holdExpiresAt: hold.expiresAt,
              items: {
                createMany: {
                  data: hold.heldSeats.map((holdSeat) => ({
                    sessionId: hold.sessionId,
                    seatId: holdSeat.seatId,
                    unitPriceCents: hold.session.priceCents,
                    currencyCode: hold.session.currencyCode
                  }))
                }
              }
            },
            include: {
              items: {
                orderBy: {
                  createdAt: "asc"
                }
              }
            }
          });

          return createdOrder;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      if (this.isPrismaErrorCode(error, "P2002")) {
        const existing = await this.findOrderByIdempotencyKey(idempotencyKey);
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException("Idempotency-Key ja utilizada com payload diferente.");
          }

          return existing;
        }

        if (this.isUniqueTarget(error, "hold_id")) {
          throw new ConflictException("Hold ja utilizada para criacao de pedido.");
        }

        throw new ConflictException("Conflito ao criar pedido.");
      }

      if (this.isPrismaErrorCode(error, "P2034")) {
        throw new ConflictException("Conflito de concorrencia ao criar pedido.");
      }

      throw error;
    }
  }

  private async findOrderByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.order.findUnique({
      where: {
        idempotencyKey
      },
      include: {
        items: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
  }

  private async expireHoldIfNeeded(
    tx: Prisma.TransactionClient,
    holdId: string,
    sessionId: string,
    status: SessionHoldStatus,
    expiresAt: Date
  ) {
    if (status !== SessionHoldStatus.ACTIVE) {
      return;
    }

    if (expiresAt > new Date()) {
      return;
    }

    await tx.sessionHold.updateMany({
      where: {
        id: holdId,
        status: SessionHoldStatus.ACTIVE
      },
      data: {
        status: SessionHoldStatus.EXPIRED
      }
    });

    await tx.sessionSeat.updateMany({
      where: {
        sessionId,
        status: SessionSeatStatus.HELD,
        holdSeats: {
          some: {
            holdId
          },
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

    throw new GoneException("Hold expirada.");
  }

  private normalizeIdempotencyKey(idempotencyKeyHeader: string | undefined): string {
    const normalized = idempotencyKeyHeader?.trim();

    if (!normalized) {
      throw new BadRequestException("Header Idempotency-Key obrigatorio.");
    }

    if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
      throw new BadRequestException("Header Idempotency-Key deve ser um UUID valido.");
    }

    return normalized.toLowerCase();
  }

  private buildRequestHash(dto: CreateOrderDto): string {
    const payload = this.stableStringify(dto);
    return createHash("sha256").update(payload).digest("hex");
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return String(value);
    }

    if (value instanceof Date) {
      return JSON.stringify(value.toISOString());
    }

    if (typeof value !== "object") {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
      .join(",")}}`;
  }

  private isPrismaErrorCode(error: unknown, code: string): boolean {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    return "code" in error && (error as { code?: string }).code === code;
  }

  private isUniqueTarget(error: unknown, target: string): boolean {
    if (typeof error !== "object" || error === null || !("meta" in error)) {
      return false;
    }

    const meta = (error as { meta?: { target?: string | string[] } }).meta;

    if (!meta || !meta.target) {
      return false;
    }

    if (Array.isArray(meta.target)) {
      return meta.target.some((entry) => entry.includes(target));
    }

    return meta.target.includes(target);
  }
}
