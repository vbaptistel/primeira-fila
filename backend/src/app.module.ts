import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuditModule } from "./common/audit/audit.module";
import { AuthModule } from "./common/auth/auth.module";
import { EmailModule } from "./common/email/email.module";
import { ProvisioningModule } from "./common/provisioning/provisioning.module";
import { TenantResolverMiddleware } from "./common/tenancy/tenant-resolver.middleware";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { CheckInModule } from "./modules/check-in/check-in.module";
import { CommercialPoliciesModule } from "./modules/commercial-policies/commercial-policies.module";
import { EventsModule } from "./modules/events/events.module";
import { HealthController } from "./modules/health/health.controller";
import { OrdersModule } from "./modules/orders/orders.module";
import { TenancyBrandingModule } from "./modules/tenancy-branding/tenancy-branding.module";

@Module({
  imports: [
    AuditModule,
    AuthModule,
    EmailModule,
    PrismaModule,
    ProvisioningModule,
    TenancyBrandingModule,
    CommercialPoliciesModule,
    EventsModule,
    OrdersModule,
    CheckInModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolverMiddleware).forRoutes("*");
  }
}
