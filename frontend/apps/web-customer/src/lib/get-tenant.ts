import { cookies } from "next/headers";
import type { TenantBranding } from "@/types/tenant";
import { getTenantCookieName, parseTenantCookie } from "@/lib/tenant";

const DEFAULT_TENANT: TenantBranding = {
  id: "",
  name: "Primeira Fila",
  slug: "default",
  subdomain: "default",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#0f766e",
  secondaryColor: "#f4f8f7",
  accentColor: "#3B82F6",
  footerText: null,
  termsUrl: null,
  privacyUrl: null,
  socialLinks: null
};

/**
 * Obtem o tenant atual a partir do cookie (server-side).
 * Retorna um tenant default caso o cookie nao esteja presente.
 */
export async function getTenant(): Promise<TenantBranding> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(getTenantCookieName());

  if (!cookie?.value) {
    return DEFAULT_TENANT;
  }

  const tenant = parseTenantCookie(cookie.value);
  return tenant ?? DEFAULT_TENANT;
}
