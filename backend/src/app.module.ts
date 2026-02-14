import { Module } from "@nestjs/common";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { EventsModule } from "./modules/events/events.module";
import { HealthController } from "./modules/health/health.controller";
import { OrdersModule } from "./modules/orders/orders.module";

@Module({
  imports: [PrismaModule, EventsModule, OrdersModule],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
