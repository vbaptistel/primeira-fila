/** Claims do JWT (Supabase getClaims ou decode inseguro). */
export type JwtClaims = Record<string, unknown> & { sub?: string };

export const APP_ROLES = ["platform_admin", "organizer_admin", "operator", "buyer"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AuthPrincipal = {
  userId: string;
  tenantId?: string;
  roles: AppRole[];
  claims: JwtClaims;
};
