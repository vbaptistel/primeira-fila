import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuditModule } from "./common/audit/audit.module";
import { AuthModule } from "./common/auth/auth.module";
import { EmailModule } from "./common/email/email.module";
import { MagicLinkModule } from "./common/magic-link/magic-link.module";
import { ProvisioningModule } from "./common/provisioning/provisioning.module";
import { TenantResolverGuard } from "./common/tenancy/tenant-resolver.guard";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { CheckInModule } from "./modules/check-in/check-in.module";
import { CommercialPoliciesModule } from "./modules/commercial-policies/commercial-policies.module";
import { EventsModule } from "./modules/events/events.module";
import { HealthController } from "./modules/health/health.controller";
import { OrdersModule } from "./modules/orders/orders.module";
import { TenancyBrandingModule } from "./modules/tenancy-branding/tenancy-branding.module";
import { TenantUsersModule } from "./modules/tenant-users/tenant-users.module";

@Module({
  imports: [
    AuditModule,
    AuthModule,
    EmailModule,
    MagicLinkModule,
    PrismaModule,
    ProvisioningModule,
    TenancyBrandingModule,
    TenantUsersModule,
    CommercialPoliciesModule,
    EventsModule,
    OrdersModule,
    CheckInModule
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: TenantResolverGuard }
  ]
})
export class AppModule {}
