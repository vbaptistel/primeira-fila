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
  PaymentStatus,
  Prisma,
  SessionHoldStatus,
  SessionSeatStatus,
  SessionStatus
} from "../../generated/prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { CreateOrderPaymentDto } from "./dto/create-order-payment.dto";
import { PaymentGatewayService } from "./payment-gateway.service";

const DEFAULT_COMMERCIAL_POLICY_VERSION = "platform_default_v1";
const DEFAULT_SERVICE_FEE_PERCENT = 0.1;
const DEFAULT_SERVICE_FEE_FIXED_CENTS = 200;
const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentGatewayService: PaymentGatewayService
  ) {}

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

  async createOrderPayment(
    orderId: string,
    idempotencyKeyHeader: string | undefined,
    dto: CreateOrderPaymentDto
  ) {
    const idempotencyKey = this.normalizeIdempotencyKey(idempotencyKeyHeader);
    const requestHash = this.buildRequestHash({
      orderId,
      gateway: dto.gateway,
      method: dto.method,
      cardToken: dto.cardToken
    });

    const existingByIdempotency = await this.findPaymentByIdempotencyKey(idempotencyKey);
    if (existingByIdempotency) {
      if (existingByIdempotency.requestHash !== requestHash) {
        throw new ConflictException("Idempotency-Key ja utilizada com payload diferente.");
      }

      return existingByIdempotency;
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: {
              id: orderId
            },
            include: {
              items: {
                orderBy: {
                  createdAt: "asc"
                }
              }
            }
          });

          if (!order) {
            throw new NotFoundException("Pedido nao encontrado.");
          }

          await this.expireOrderIfNeeded(tx, order);

          if (order.status !== OrderStatus.PENDING_PAYMENT) {
            throw new ConflictException("Pedido nao aceita novo pagamento.");
          }

          const gatewayResult = await this.paymentGatewayService.charge({
            provider: dto.gateway,
            method: dto.method,
            cardToken: dto.cardToken,
            amountCents: order.totalAmountCents,
            currencyCode: order.currencyCode,
            orderId: order.id
          });

          const payment = await tx.payment.create({
            data: {
              tenantId: order.tenantId,
              orderId: order.id,
              idempotencyKey,
              requestHash,
              provider: gatewayResult.provider,
              providerPaymentId: gatewayResult.providerPaymentId,
              method: dto.method,
              status: gatewayResult.status,
              amountCents: order.totalAmountCents,
              currencyCode: order.currencyCode,
              providerPayload: gatewayResult.providerPayload as Prisma.InputJsonValue,
              approvedAt: gatewayResult.status === PaymentStatus.APPROVED ? new Date() : undefined,
              deniedAt: gatewayResult.status === PaymentStatus.DENIED ? new Date() : undefined
            }
          });

          if (gatewayResult.status === PaymentStatus.APPROVED) {
            await tx.order.update({
              where: {
                id: order.id
              },
              data: {
                status: OrderStatus.PAID
              }
            });

            await tx.sessionHold.updateMany({
              where: {
                id: order.holdId,
                status: SessionHoldStatus.ACTIVE
              },
              data: {
                status: SessionHoldStatus.CONSUMED
              }
            });

            await tx.sessionSeat.updateMany({
              where: {
                id: {
                  in: order.items.map((item) => item.seatId)
                },
                sessionId: order.sessionId,
                status: SessionSeatStatus.HELD
              },
              data: {
                status: SessionSeatStatus.SOLD
              }
            });
          }

          return tx.payment.findUnique({
            where: {
              id: payment.id
            },
            include: {
              order: {
                include: {
                  items: {
                    orderBy: {
                      createdAt: "asc"
                    }
                  }
                }
              }
            }
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      if (this.isPrismaErrorCode(error, "P2002")) {
        const existing = await this.findPaymentByIdempotencyKey(idempotencyKey);
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException("Idempotency-Key ja utilizada com payload diferente.");
          }

          return existing;
        }

        throw new ConflictException("Conflito ao registrar pagamento.");
      }

      if (this.isPrismaErrorCode(error, "P2034")) {
        throw new ConflictException("Conflito de concorrencia ao registrar pagamento.");
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

  private async findPaymentByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.payment.findUnique({
      where: {
        idempotencyKey
      },
      include: {
        order: {
          include: {
            items: {
              orderBy: {
                createdAt: "asc"
              }
            }
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

  private async expireOrderIfNeeded(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      holdId: string;
      sessionId: string;
      status: OrderStatus;
      holdExpiresAt: Date;
    }
  ) {
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return;
    }

    if (order.holdExpiresAt > new Date()) {
      return;
    }

    await tx.order.updateMany({
      where: {
        id: order.id,
        status: OrderStatus.PENDING_PAYMENT
      },
      data: {
        status: OrderStatus.EXPIRED
      }
    });

    await tx.sessionHold.updateMany({
      where: {
        id: order.holdId,
        status: SessionHoldStatus.ACTIVE
      },
      data: {
        status: SessionHoldStatus.EXPIRED
      }
    });

    await tx.sessionSeat.updateMany({
      where: {
        sessionId: order.sessionId,
        status: SessionSeatStatus.HELD,
        holdSeats: {
          some: {
            holdId: order.holdId
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

    throw new GoneException("Pedido expirado para pagamento.");
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

  private buildRequestHash(payload: unknown): string {
    const normalized = this.stableStringify(payload);
    return createHash("sha256").update(normalized).digest("hex");
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
