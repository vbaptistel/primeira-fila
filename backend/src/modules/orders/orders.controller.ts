import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateOrderDto } from "./dto/create-order.dto";
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
}
