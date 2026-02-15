import { Module } from "@nestjs/common";
import { AuthModule } from "./common/auth/auth.module";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { CommercialPoliciesModule } from "./modules/commercial-policies/commercial-policies.module";
import { EventsModule } from "./modules/events/events.module";
import { HealthController } from "./modules/health/health.controller";
import { OrdersModule } from "./modules/orders/orders.module";

@Module({
  imports: [AuthModule, PrismaModule, CommercialPoliciesModule, EventsModule, OrdersModule],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
