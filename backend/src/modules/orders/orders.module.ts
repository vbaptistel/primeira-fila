import { Module } from "@nestjs/common";
import { CommercialPoliciesModule } from "../commercial-policies/commercial-policies.module";
import { OrdersAdminController, OrdersController, RefundsController, WebhooksController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentGatewayService } from "./payment-gateway.service";

@Module({
  imports: [CommercialPoliciesModule],
  controllers: [OrdersController, OrdersAdminController, WebhooksController, RefundsController],
  providers: [OrdersService, PaymentGatewayService],
  exports: [OrdersService]
})
export class OrdersModule {}
