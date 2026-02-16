import { Module } from "@nestjs/common";
import { TenantUsersController } from "./tenant-users.controller";
import { TenantUsersService } from "./tenant-users.service";
import { TenancyBrandingModule } from "../tenancy-branding/tenancy-branding.module";

@Module({
  imports: [TenancyBrandingModule],
  controllers: [TenantUsersController],
  providers: [TenantUsersService],
  exports: [TenantUsersService]
})
export class TenantUsersModule {}
