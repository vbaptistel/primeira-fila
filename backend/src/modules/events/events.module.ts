import { Module } from "@nestjs/common";
import { EventsAdminController, EventsPublicController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  controllers: [EventsAdminController, EventsPublicController],
  providers: [EventsService]
})
export class EventsModule {}
