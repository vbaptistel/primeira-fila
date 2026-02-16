import { Body, Controller, DefaultValuePipe, Get, Headers, HttpCode, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { AuthPrincipal } from "../../common/auth/auth.types";
import { TenantRbacGuard } from "../../common/auth/tenant-rbac.guard";
import { TenantRoles } from "../../common/auth/roles.decorator";
import { CreateOrderDto } from "./dto/create-order.dto";
import { CreateOrderPaymentDto } from "./dto/create-order-payment.dto";
import { CreateRefundDto } from "./dto/create-refund.dto";
import { RequestOrderAccessDto } from "./dto/request-order-access.dto";
import { WebhookPaymentDto } from "./dto/webhook-payment.dto";
import { OrdersService } from "./orders.service";

@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreateOrderDto
  ) {
    return this.ordersService.createOrder(idempotencyKey, dto);
  }

  @Post(":orderId/payments")
  createOrderPayment(
    @Param("orderId") orderId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreateOrderPaymentDto
  ) {
    return this.ordersService.createOrderPayment(orderId, idempotencyKey, dto);
  }

  @Get(":orderId")
  getOrderByToken(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Query("token") token: string,
    @Query("email") email: string
  ) {
    return this.ordersService.getOrderByToken(orderId, token, email);
  }

  @Get(":orderId/tickets")
  getOrderTickets(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Query("token") token?: string,
    @Query("email") email?: string
  ) {
    return this.ordersService.getOrderTickets(orderId, token, email);
  }

  @Post("request-access")
  @HttpCode(HttpStatus.OK)
  requestOrderAccess(@Body() dto: RequestOrderAccessDto) {
    return this.ordersService.requestOrderAccess(dto.email);
  }
}

@ApiTags("orders-admin")
@UseGuards(TenantRbacGuard)
@TenantRoles("organizer_admin", "platform_admin")
@Controller("tenants/:tenantId/orders")
export class OrdersAdminController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  listTenantOrders(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Query("status") status?: string,
    @Query("eventId") eventId?: string,
    @Query("sessionId") sessionId?: string,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset?: number
  ) {
    return this.ordersService.listTenantOrders(tenantId, { status, eventId, sessionId, limit, offset });
  }
}

@ApiTags("refunds")
@UseGuards(TenantRbacGuard)
@TenantRoles("organizer_admin", "platform_admin")
@Controller("tenants/:tenantId/orders/:orderId/refunds")
export class RefundsController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createRefund(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Req() request: FastifyRequest & { authPrincipal?: AuthPrincipal },
    @Body() dto: CreateRefundDto
  ) {
    const requestedBy = request.authPrincipal?.userId ?? "unknown";
    return this.ordersService.createRefund(tenantId, orderId, requestedBy, dto);
  }
}

@ApiTags("webhooks")
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("payments")
  @HttpCode(HttpStatus.OK)
  processPaymentWebhook(@Body() dto: WebhookPaymentDto) {
    return this.ordersService.processWebhook(dto);
  }
}
