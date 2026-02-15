import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { APP_ROLES, AppRole, AuthPrincipal, type JwtClaims } from "./auth.types";

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

/** Decodifica o payload de um JWT sem verificar assinatura (apenas base64url). */
function decodeJwtPayloadUnsafe(token: string): JwtClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Token invalido.");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf8");
  const decoded = JSON.parse(payload) as unknown;
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Token invalido.");
  }
  return decoded as JwtClaims;
}

@Injectable()
export class SupabaseJwtVerifierService {
  private supabase: SupabaseClient | null = null;

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

  private async verifyAndDecode(token: string): Promise<JwtClaims> {
    if (this.isInsecureDecodeEnabled()) {
      try {
        return decodeJwtPayloadUnsafe(token);
      } catch {
        throw new UnauthorizedException("Token invalido.");
      }
    }

    const client = this.getSupabaseClient();
    const { data, error } = await client.auth.getClaims(token);

    if (error) {
      throw new UnauthorizedException("Token invalido.");
    }
    if (!data?.claims) {
      throw new UnauthorizedException("Token invalido.");
    }

    return data.claims as JwtClaims;
  }

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY;

      if (!url || !key) {
        throw new UnauthorizedException(
          "Configuracao de verificacao JWT ausente. Defina SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_PUBLISHABLE_KEY (ou SUPABASE_ANON_KEY)."
        );
      }

      this.supabase = createClient(url, key, {
        auth: { persistSession: false }
      });
    }

    return this.supabase;
  }

  private isInsecureDecodeEnabled(): boolean {
    return process.env.AUTH_JWT_INSECURE_DECODE === "true";
  }

  private readUserId(payload: JwtClaims): string {
    const subject = payload.sub;
    if (!subject) {
      throw new UnauthorizedException("Token sem subject.");
    }

    return subject;
  }

  private readRoles(payload: JwtClaims): AppRole[] {
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

  private readTenantId(payload: JwtClaims): string | undefined {
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
