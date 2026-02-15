import { Module } from "@nestjs/common";
import { CommercialPoliciesController } from "./commercial-policies.controller";
import { CommercialPoliciesService } from "./commercial-policies.service";

@Module({
  controllers: [CommercialPoliciesController],
  providers: [CommercialPoliciesService],
  exports: [CommercialPoliciesService]
})
export class CommercialPoliciesModule {}
