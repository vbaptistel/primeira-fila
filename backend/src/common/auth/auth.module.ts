import { Global, Module } from "@nestjs/common";
import { SupabaseJwtVerifierService } from "./supabase-jwt-verifier.service";
import { TenantRbacGuard } from "./tenant-rbac.guard";

@Global()
@Module({
  providers: [SupabaseJwtVerifierService, TenantRbacGuard],
  exports: [SupabaseJwtVerifierService, TenantRbacGuard]
})
export class AuthModule {}
