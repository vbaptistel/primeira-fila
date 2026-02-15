import { Module } from "@nestjs/common";
import { TenancyBrandingController } from "./tenancy-branding.controller";
import { TenancyBrandingService } from "./tenancy-branding.service";
import { TenantResolutionService } from "./tenant-resolution.service";
import { CustomDomainService } from "./custom-domain.service";
import { SubdomainProvisioningService } from "./subdomain-provisioning.service";
import { VercelApiClient } from "./vercel-api.client";

@Module({
  controllers: [TenancyBrandingController],
  providers: [
    { provide: VercelApiClient, useFactory: () => new VercelApiClient() },
    TenancyBrandingService,
    TenantResolutionService,
    CustomDomainService,
    SubdomainProvisioningService
  ],
  exports: [TenancyBrandingService, TenantResolutionService, CustomDomainService]
})
export class TenancyBrandingModule {}
