import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentGatewayService } from "./payment-gateway.service";

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, PaymentGatewayService]
})
export class OrdersModule {}
