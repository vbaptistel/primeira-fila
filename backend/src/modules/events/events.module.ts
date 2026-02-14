import { Module } from "@nestjs/common";
import { EventsAdminController, EventsPublicController, SessionsPublicController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  controllers: [EventsAdminController, EventsPublicController, SessionsPublicController],
  providers: [EventsService]
})
export class EventsModule {}
