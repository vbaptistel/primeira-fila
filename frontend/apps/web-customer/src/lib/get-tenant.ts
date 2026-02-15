import { cookies } from "next/headers";
import type { TenantBranding } from "@/types/tenant";
import { getTenantCookieName, parseTenantCookie } from "@/lib/tenant";

/**
 * Obtem o tenant atual a partir do cookie (server-side).
 * Retorna null quando nao ha cookie valido ou ha falha no parsing.
 */
export async function getTenant(): Promise<TenantBranding | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(getTenantCookieName());

    if (!cookie?.value) {
      return null;
    }

    const tenant = parseTenantCookie(cookie.value);
    return tenant ?? null;
  } catch {
    return null;
  }
}
