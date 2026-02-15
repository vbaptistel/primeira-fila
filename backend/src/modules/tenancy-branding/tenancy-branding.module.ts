import { Module } from "@nestjs/common";
import { TenancyBrandingController } from "./tenancy-branding.controller";
import { TenancyBrandingService } from "./tenancy-branding.service";
import { CustomDomainService } from "./custom-domain.service";

@Module({
  controllers: [TenancyBrandingController],
  providers: [TenancyBrandingService, CustomDomainService],
  exports: [TenancyBrandingService, CustomDomainService]
})
export class TenancyBrandingModule {}
