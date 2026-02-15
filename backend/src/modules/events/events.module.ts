import { Module } from "@nestjs/common";
import { CommercialPoliciesModule } from "../commercial-policies/commercial-policies.module";
import { TenancyBrandingModule } from "../tenancy-branding/tenancy-branding.module";
import { EventsAdminController, EventsPublicController, SessionsPublicController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  imports: [CommercialPoliciesModule, TenancyBrandingModule],
  controllers: [EventsAdminController, EventsPublicController, SessionsPublicController],
  providers: [EventsService]
})
export class EventsModule {}
