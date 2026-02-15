import type { TenantBranding } from "@/types/tenant";

const TENANT_COOKIE_NAME = "pf-tenant";
const TENANT_COOKIE_MAX_AGE = 60 * 5; // 5 minutos

const LIGHT_PALETTE = {
  surface: "#ffffff",
  text: "#172421",
  mutedText: "#45635e",
  border: "#c9ddd8",
  primaryText: "#f3fffd",
  accentText: "#ffffff"
};

const DARK_PALETTE = {
  surface: "#1a1a1a",
  text: "#ededed",
  mutedText: "#a1a1a1",
  border: "#333333",
  primaryText: "#f3fffd",
  accentText: "#ffffff"
};

function resolveColorScheme(tenant: TenantBranding): "light" | "dark" {
  const scheme = tenant.colorScheme ?? "light";
  if (scheme === "light") return "light";
  if (scheme === "dark") return "dark";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

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
 * Usa colorScheme (light/dark/system) para determinar a paleta de surface, text e muted-text.
 */
export function applyTenantBranding(tenant: TenantBranding): void {
  const root = document.documentElement;
  const scheme = resolveColorScheme(tenant);
  const palette = scheme === "light" ? LIGHT_PALETTE : DARK_PALETTE;

  root.style.setProperty("--pf-color-primary", tenant.primaryColor);
  root.style.setProperty("--pf-color-background", tenant.secondaryColor);
  root.style.setProperty("--pf-color-accent", tenant.accentColor);
  root.style.setProperty("--background", tenant.secondaryColor);
  root.style.setProperty("--foreground", palette.text);
  root.style.setProperty("--pf-color-surface", palette.surface);
  root.style.setProperty("--pf-color-text", palette.text);
  root.style.setProperty("--pf-color-muted-text", palette.mutedText);
  root.style.setProperty("--pf-color-border", palette.border);
  root.style.setProperty("--pf-color-primary-text", palette.primaryText);
  root.style.setProperty("--pf-color-accent-text", palette.accentText);
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
