import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  EventStatus,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  SessionHoldStatus,
  SessionSeatStatus,
  SessionStatus,
  TicketStatus
} from "../../generated/prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { AuditService } from "../../common/audit/audit.service";
import { EmailService } from "../../common/email/email.service";
import { MagicLinkTokenService } from "../../common/magic-link/magic-link-token.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CommercialPoliciesService } from "../commercial-policies/commercial-policies.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { CreateOrderPaymentDto } from "./dto/create-order-payment.dto";
import { CreateRefundDto } from "./dto/create-refund.dto";
import { WebhookPaymentDto } from "./dto/webhook-payment.dto";
import { PaymentGatewayService } from "./payment-gateway.service";

const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commercialPoliciesService: CommercialPoliciesService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly magicLinkTokenService: MagicLinkTokenService
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
          const activePolicy = await this.commercialPoliciesService.getActivePolicy(hold.tenantId, tx);
          const serviceFeePercent = activePolicy.serviceFeePercentBps / 10_000;
          const serviceFeeCents = Math.round(
            ticketSubtotalCents * serviceFeePercent + activePolicy.serviceFeeFixedCents
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
              commercialPolicyVersion: activePolicy.version,
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

    let result;

    try {
      result = await this.prisma.$transaction(
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
            await this.approveOrder(tx, order);
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

    if (result?.order?.status === OrderStatus.PAID) {
      await this.sendOrderConfirmationEmail(result.order);
    }

    return result;
  }

  async processWebhook(dto: WebhookPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        providerPaymentId: dto.providerPaymentId
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

    if (!payment) {
      throw new NotFoundException("Pagamento nao encontrado para o providerPaymentId informado.");
    }

    if (payment.status === dto.status) {
      return { processed: false, reason: "Status ja aplicado.", paymentId: payment.id };
    }

    if (payment.status === PaymentStatus.APPROVED || payment.status === PaymentStatus.REFUNDED) {
      return { processed: false, reason: "Pagamento em estado terminal.", paymentId: payment.id };
    }

    let wasApproved = false;
    let webhookOrder = payment.order;

    let result;

    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          const freshPayment = await tx.payment.findUnique({
            where: { id: payment.id },
            include: {
              order: {
                include: {
                  items: { orderBy: { createdAt: "asc" } }
                }
              }
            }
          });

          if (!freshPayment) {
            throw new NotFoundException("Pagamento nao encontrado.");
          }

          if (
            freshPayment.status === dto.status ||
            freshPayment.status === PaymentStatus.APPROVED ||
            freshPayment.status === PaymentStatus.REFUNDED
          ) {
            return {
              processed: false,
              reason: "Pagamento ja processado.",
              paymentId: freshPayment.id
            };
          }

          await tx.payment.update({
            where: { id: freshPayment.id },
            data: {
              status: dto.status,
              providerPayload: dto.payload as Prisma.InputJsonValue ?? undefined,
              approvedAt: dto.status === PaymentStatus.APPROVED ? new Date() : undefined,
              deniedAt: dto.status === PaymentStatus.DENIED ? new Date() : undefined
            }
          });

          if (
            dto.status === PaymentStatus.APPROVED &&
            freshPayment.order.status === OrderStatus.PENDING_PAYMENT
          ) {
            await this.approveOrder(tx, freshPayment.order);
            wasApproved = true;
            webhookOrder = freshPayment.order;
          }

          return { processed: true, paymentId: freshPayment.id };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      if (this.isPrismaErrorCode(error, "P2034")) {
        throw new ConflictException("Conflito de concorrencia ao processar webhook.");
      }

      throw error;
    }

    if (wasApproved && webhookOrder) {
      const freshOrder = await this.prisma.order.findUnique({
        where: { id: webhookOrder.id },
        include: {
          session: { select: { name: true } },
          items: { orderBy: { createdAt: "asc" } },
          tickets: {
            include: {
              seat: { select: { sectorCode: true, rowLabel: true, seatNumber: true } },
              session: { select: { name: true } }
            }
          }
        }
      });

      if (freshOrder) {
        await this.sendOrderConfirmationEmail(freshOrder);
      }
    }

    return result;
  }

  async getOrderByToken(orderId: string, token: string, email: string): Promise<object> {
    if (!token || !email) {
      throw new ForbiddenException("Token e email sao obrigatorios para acessar o pedido.");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isValid = this.magicLinkTokenService.validateToken(orderId, normalizedEmail, token);

    if (!isValid) {
      throw new ForbiddenException("Token invalido ou expirado.");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        session: true,
        items: { orderBy: { createdAt: "asc" } },
        tickets: {
          include: {
            seat: true,
            session: true
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!order || order.buyerEmail !== normalizedEmail) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    return {
      id: order.id,
      status: order.status,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      ticketSubtotalCents: order.ticketSubtotalCents,
      serviceFeeCents: order.serviceFeeCents,
      totalAmountCents: order.totalAmountCents,
      currencyCode: order.currencyCode,
      createdAt: order.createdAt,
      session: {
        id: order.session.id,
        name: order.session.name,
        startsAt: order.session.startsAt,
        endsAt: order.session.endsAt
      },
      items: order.items.map((item) => ({
        id: item.id,
        unitPriceCents: item.unitPriceCents,
        currencyCode: item.currencyCode
      })),
      tickets: order.tickets.map((ticket) => ({
        id: ticket.id,
        qrCode: ticket.qrCode,
        status: ticket.status,
        seat: {
          id: ticket.seat.id,
          sectorCode: ticket.seat.sectorCode,
          rowLabel: ticket.seat.rowLabel,
          seatNumber: ticket.seat.seatNumber
        },
        session: {
          id: ticket.session.id,
          name: ticket.session.name,
          startsAt: ticket.session.startsAt,
          endsAt: ticket.session.endsAt
        }
      }))
    };
  }

  async getOrderTickets(orderId: string, token?: string, email?: string) {
    if (token && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const isValid = this.magicLinkTokenService.validateToken(orderId, normalizedEmail, token);

      if (!isValid) {
        throw new ForbiddenException("Token invalido ou expirado.");
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order || order.buyerEmail !== normalizedEmail) {
        throw new NotFoundException("Pedido nao encontrado.");
      }
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    const tickets = await this.prisma.ticket.findMany({
      where: { orderId },
      include: {
        seat: {
          select: {
            id: true,
            sectorCode: true,
            rowLabel: true,
            seatNumber: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return tickets;
  }

  async requestOrderAccess(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const orders = await this.prisma.order.findMany({
      where: {
        buyerEmail: normalizedEmail,
        status: {
          in: [OrderStatus.PAID, OrderStatus.PENDING_PAYMENT]
        }
      },
      include: {
        session: { select: { name: true } },
        tenant: { select: { subdomain: true, customDomain: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    // Sempre retorna sucesso para nao vazar informacao sobre existencia de pedidos
    if (orders.length === 0) {
      return { message: "Se existirem pedidos para este e-mail, voce recebera um link de acesso." };
    }

    const frontendBaseUrl = process.env["FRONTEND_URL"] ?? "https://primeirafila.com";

    for (const order of orders) {
      try {
        const tenantBaseUrl = order.tenant?.customDomain
          ? `https://${order.tenant.customDomain}`
          : order.tenant?.subdomain
            ? `https://${order.tenant.subdomain}.${new URL(frontendBaseUrl).host}`
            : frontendBaseUrl;

        const orderAccessUrl = this.magicLinkTokenService.buildOrderAccessUrl(
          tenantBaseUrl,
          order.id,
          normalizedEmail
        );

        await this.emailService.sendOrderAccessLink({
          tenantId: order.tenantId,
          orderId: order.id,
          buyerName: order.buyerName,
          buyerEmail: normalizedEmail,
          sessionName: order.session.name,
          orderAccessUrl
        });
      } catch {
        // Erro de e-mail nunca bloqueia o fluxo
      }
    }

    return { message: "Se existirem pedidos para este e-mail, voce recebera um link de acesso." };
  }

  async createRefund(tenantId: string, orderId: string, requestedBy: string, dto: CreateRefundDto) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: orderId },
            include: {
              items: { orderBy: { createdAt: "asc" } },
              payments: {
                where: { status: PaymentStatus.APPROVED },
                orderBy: { createdAt: "desc" },
                take: 1
              }
            }
          });

          if (!order) {
            throw new NotFoundException("Pedido nao encontrado.");
          }

          if (order.tenantId !== tenantId) {
            throw new NotFoundException("Pedido nao encontrado.");
          }

          if (order.status !== OrderStatus.PAID) {
            throw new ConflictException("Somente pedidos pagos podem ser reembolsados.");
          }

          const approvedPayment = order.payments[0];
          if (!approvedPayment) {
            throw new ConflictException("Nenhum pagamento aprovado encontrado para reembolso.");
          }

          const refund = await tx.refund.create({
            data: {
              tenantId,
              orderId: order.id,
              paymentId: approvedPayment.id,
              reasonCode: dto.reasonCode,
              reasonDescription: dto.reasonDescription,
              amountCents: approvedPayment.amountCents,
              status: RefundStatus.APPROVED,
              requestedBy,
              processedAt: new Date()
            }
          });

          await tx.payment.update({
            where: { id: approvedPayment.id },
            data: { status: PaymentStatus.REFUNDED }
          });

          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELLED }
          });

          await tx.ticket.updateMany({
            where: {
              orderId: order.id,
              status: TicketStatus.VALID
            },
            data: { status: TicketStatus.CANCELLED }
          });

          await tx.sessionSeat.updateMany({
            where: {
              id: { in: order.items.map((item) => item.seatId) },
              sessionId: order.sessionId,
              status: SessionSeatStatus.SOLD
            },
            data: { status: SessionSeatStatus.AVAILABLE }
          });

          await tx.sessionHold.updateMany({
            where: {
              id: order.holdId,
              status: SessionHoldStatus.CONSUMED
            },
            data: { status: SessionHoldStatus.CANCELLED }
          });

          await this.auditService.log(
            {
              tenantId,
              actorId: requestedBy,
              action: AuditAction.REFUND_APPROVED,
              resourceType: "refund",
              resourceId: refund.id,
              metadata: {
                orderId: order.id,
                paymentId: approvedPayment.id,
                reasonCode: dto.reasonCode,
                amountCents: approvedPayment.amountCents
              }
            },
            tx
          );

          return refund;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      if (this.isPrismaErrorCode(error, "P2034")) {
        throw new ConflictException("Conflito de concorrencia ao processar reembolso.");
      }

      throw error;
    }
  }

  private async sendOrderConfirmationEmail(
    order: {
      id: string;
      tenantId: string;
      buyerName: string;
      buyerEmail: string;
      ticketSubtotalCents: number;
      serviceFeeCents: number;
      totalAmountCents: number;
      currencyCode: string;
      session?: { name: string };
      tickets?: {
        qrCode: string;
        seat: { sectorCode: string; rowLabel: string; seatNumber: number };
        session: { name: string };
      }[];
    }
  ): Promise<void> {
    try {
      let sessionName = order.session?.name ?? "";
      let tickets = order.tickets ?? [];

      if (!order.session || !order.tickets?.length) {
        const fullOrder = await this.prisma.order.findUnique({
          where: { id: order.id },
          include: {
            session: { select: { name: true } },
            tickets: {
              include: {
                seat: { select: { sectorCode: true, rowLabel: true, seatNumber: true } },
                session: { select: { name: true } }
              }
            }
          }
        });

        if (fullOrder) {
          sessionName = fullOrder.session.name;
          tickets = fullOrder.tickets;
        }
      }

      const frontendBaseUrl = process.env["FRONTEND_URL"] ?? "https://primeirafila.com";
      const orderAccessUrl = this.magicLinkTokenService.buildOrderAccessUrl(
        frontendBaseUrl,
        order.id,
        order.buyerEmail
      );

      await this.emailService.sendOrderConfirmation({
        tenantId: order.tenantId,
        orderId: order.id,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        sessionName,
        ticketSubtotalCents: order.ticketSubtotalCents,
        serviceFeeCents: order.serviceFeeCents,
        totalAmountCents: order.totalAmountCents,
        currencyCode: order.currencyCode,
        orderAccessUrl,
        tickets: tickets.map((t) => ({
          qrCode: t.qrCode,
          sessionName: t.session.name,
          seatSector: t.seat.sectorCode,
          seatRow: t.seat.rowLabel,
          seatNumber: t.seat.seatNumber
        }))
      });
    } catch {
      // Erro de e-mail nunca bloqueia o fluxo de compra
      // O EmailService ja registra o erro no EmailLog
    }
  }

  private async approveOrder(
    tx: Prisma.TransactionClient,
    order: Order & { items: OrderItem[] }
  ): Promise<void> {
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID }
    });

    await tx.sessionHold.updateMany({
      where: {
        id: order.holdId,
        status: SessionHoldStatus.ACTIVE
      },
      data: { status: SessionHoldStatus.CONSUMED }
    });

    await tx.sessionSeat.updateMany({
      where: {
        id: { in: order.items.map((item) => item.seatId) },
        sessionId: order.sessionId,
        status: SessionSeatStatus.HELD
      },
      data: { status: SessionSeatStatus.SOLD }
    });

    await this.generateTickets(tx, order);
  }

  private async generateTickets(
    tx: Prisma.TransactionClient,
    order: Order & { items: OrderItem[] }
  ): Promise<void> {
    if (!order.items.length) {
      return;
    }

    const ticketData = order.items.map((item) => ({
      tenantId: order.tenantId,
      orderId: order.id,
      orderItemId: item.id,
      sessionId: item.sessionId,
      seatId: item.seatId,
      qrCode: randomUUID(),
      status: TicketStatus.VALID
    }));

    await tx.ticket.createMany({ data: ticketData });
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
