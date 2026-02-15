import type { TenantBranding } from "@/types/tenant";

const TENANT_COOKIE_NAME = "pf-tenant";
const TENANT_COOKIE_MAX_AGE = 60 * 5; // 5 minutos

export function buildTenantCookieValue(tenant: TenantBranding): string {
  return Buffer.from(JSON.stringify(tenant)).toString("base64");
}

export function parseTenantCookie(value: string): TenantBranding | null {
  try {
    const json = Buffer.from(value, "base64").toString("utf-8");
    return JSON.parse(json) as TenantBranding;
  } catch {
    return null;
  }
}

export function getTenantCookieName(): string {
  return TENANT_COOKIE_NAME;
}

export function getTenantCookieMaxAge(): number {
  return TENANT_COOKIE_MAX_AGE;
}

/**
 * Aplica as CSS variables de branding do tenant na raiz do documento.
 */
export function applyTenantBranding(tenant: TenantBranding): void {
  const root = document.documentElement;
  root.style.setProperty("--pf-color-primary", tenant.primaryColor);
  root.style.setProperty("--pf-color-background", tenant.secondaryColor);
  root.style.setProperty("--pf-color-accent", tenant.accentColor);
}

/**
 * Formata valor em centavos para moeda.
 */
export function formatCurrency(cents: number, currencyCode = "BRL"): string {
  const value = cents / 100;
  if (currencyCode === "BRL") {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }
  return `${currencyCode} ${value.toFixed(2)}`;
}
