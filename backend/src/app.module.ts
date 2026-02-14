import { Module } from "@nestjs/common";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { EventsModule } from "./modules/events/events.module";
import { HealthController } from "./modules/health/health.controller";

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
