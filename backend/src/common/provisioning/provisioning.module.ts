import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { CommercialPoliciesModule } from "../../modules/commercial-policies/commercial-policies.module";
import { TenancyBrandingModule } from "../../modules/tenancy-branding/tenancy-branding.module";
import { TenantProvisioningInterceptor } from "./tenant-provisioning.interceptor";

@Global()
@Module({
  imports: [CommercialPoliciesModule, TenancyBrandingModule],
  providers: [
    TenantProvisioningInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: TenantProvisioningInterceptor
    }
  ],
  exports: [TenantProvisioningInterceptor]
})
export class ProvisioningModule {}
