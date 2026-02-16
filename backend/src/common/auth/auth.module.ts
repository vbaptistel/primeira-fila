import { Global, Module } from "@nestjs/common";
import { SupabaseAdminUsersService } from "./supabase-admin-users.service";
import { SupabaseJwtVerifierService } from "./supabase-jwt-verifier.service";
import { TenantRbacGuard } from "./tenant-rbac.guard";

@Global()
@Module({
  providers: [SupabaseJwtVerifierService, TenantRbacGuard, SupabaseAdminUsersService],
  exports: [SupabaseJwtVerifierService, TenantRbacGuard, SupabaseAdminUsersService]
})
export class AuthModule {}
