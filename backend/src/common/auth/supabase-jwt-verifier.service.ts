import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, decodeJwt, JWTPayload, jwtVerify, JWTVerifyOptions } from "jose";
import { URL } from "node:url";
import { APP_ROLES, AppRole, AuthPrincipal } from "./auth.types";

type AnyRecord = Record<string, unknown>;

const ROLE_CLAIM_PATHS = [
  ["user_role"],
  ["role"],
  ["roles"],
  ["app_metadata", "role"],
  ["app_metadata", "roles"]
];

const TENANT_CLAIM_PATHS = [
  ["tenant_id"],
  ["tenantId"],
  ["app_metadata", "tenant_id"],
  ["app_metadata", "tenantId"]
];

@Injectable()
export class SupabaseJwtVerifierService {
  private jwksResolver: ReturnType<typeof createRemoteJWKSet> | null = null;

  async verifyToken(token: string): Promise<AuthPrincipal> {
    const payload = await this.verifyAndDecode(token);
    const userId = this.readUserId(payload);
    const roles = this.readRoles(payload);
    const tenantId = this.readTenantId(payload);

    return {
      userId,
      tenantId,
      roles,
      claims: payload
    };
  }

  private async verifyAndDecode(token: string): Promise<JWTPayload> {
    if (this.isInsecureDecodeEnabled()) {
      try {
        return decodeJwt(token);
      } catch {
        throw new UnauthorizedException("Token invalido.");
      }
    }

    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    const verifyOptions = this.buildVerifyOptions();

    if (jwtSecret) {
      try {
        const { payload } = await jwtVerify(
          token,
          new TextEncoder().encode(jwtSecret),
          verifyOptions
        );
        return payload;
      } catch {
        throw new UnauthorizedException("Token invalido.");
      }
    }

    const jwksUrl = this.getJwksUrl();
    if (!jwksUrl) {
      throw new UnauthorizedException(
        "Configuracao de verificacao JWT ausente. Defina SUPABASE_JWT_SECRET ou SUPABASE_JWKS_URL."
      );
    }

    try {
      const resolver = this.getOrCreateJwksResolver(jwksUrl);
      const { payload } = await jwtVerify(token, resolver, verifyOptions);
      return payload;
    } catch {
      throw new UnauthorizedException("Token invalido.");
    }
  }

  private getOrCreateJwksResolver(jwksUrl: string) {
    if (!this.jwksResolver) {
      this.jwksResolver = createRemoteJWKSet(new URL(jwksUrl));
    }

    return this.jwksResolver;
  }

  private buildVerifyOptions(): JWTVerifyOptions {
    const issuer = process.env.SUPABASE_JWT_ISSUER;
    const audience = process.env.SUPABASE_JWT_AUDIENCE;

    return {
      issuer: issuer || undefined,
      audience: audience || undefined
    };
  }

  private getJwksUrl(): string | null {
    const explicit = process.env.SUPABASE_JWKS_URL;
    if (explicit) {
      return explicit;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return null;
    }

    return `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`;
  }

  private isInsecureDecodeEnabled(): boolean {
    return process.env.AUTH_JWT_INSECURE_DECODE === "true";
  }

  private readUserId(payload: JWTPayload): string {
    const subject = payload.sub;
    if (!subject) {
      throw new UnauthorizedException("Token sem subject.");
    }

    return subject;
  }

  private readRoles(payload: JWTPayload): AppRole[] {
    const roles = new Set<AppRole>();

    for (const path of ROLE_CLAIM_PATHS) {
      const claim = this.readPath(payload as AnyRecord, path);
      this.collectRolesFromClaim(claim, roles);
    }

    return Array.from(roles.values());
  }

  private collectRolesFromClaim(claim: unknown, collector: Set<AppRole>): void {
    if (typeof claim === "string") {
      for (const chunk of claim.split(/[,\s]+/)) {
        const role = this.normalizeRole(chunk);
        if (role) {
          collector.add(role);
        }
      }
      return;
    }

    if (Array.isArray(claim)) {
      for (const item of claim) {
        if (typeof item === "string") {
          const role = this.normalizeRole(item);
          if (role) {
            collector.add(role);
          }
        }
      }
    }
  }

  private normalizeRole(value: string): AppRole | null {
    const normalized = value.trim().toLowerCase();
    if (APP_ROLES.includes(normalized as AppRole)) {
      return normalized as AppRole;
    }

    return null;
  }

  private readTenantId(payload: JWTPayload): string | undefined {
    for (const path of TENANT_CLAIM_PATHS) {
      const claim = this.readPath(payload as AnyRecord, path);
      if (typeof claim === "string" && claim.trim().length > 0) {
        return claim.trim();
      }
    }

    return undefined;
  }

  private readPath(root: AnyRecord, path: string[]): unknown {
    let current: unknown = root;

    for (const key of path) {
      if (typeof current !== "object" || current === null || !(key in current)) {
        return undefined;
      }
      current = (current as AnyRecord)[key];
    }

    return current;
  }
}
