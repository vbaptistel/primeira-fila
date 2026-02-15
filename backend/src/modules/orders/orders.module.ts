import { Module } from "@nestjs/common";
import { CommercialPoliciesModule } from "../commercial-policies/commercial-policies.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentGatewayService } from "./payment-gateway.service";

@Module({
  imports: [CommercialPoliciesModule],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentGatewayService]
})
export class OrdersModule {}
