import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateOrderDto } from "./dto/create-order.dto";
import { CreateOrderPaymentDto } from "./dto/create-order-payment.dto";
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
}
