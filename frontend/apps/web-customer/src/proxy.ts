import { getTenantCookieMaxAge, getTenantCookieName } from "@/lib/tenant";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TENANT_COOKIE = getTenantCookieName();
const COOKIE_MAX_AGE = getTenantCookieMaxAge();

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignorar arquivos estaticos e API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Verificar se ja tem cookie de tenant valido
  const existingCookie = request.cookies.get(TENANT_COOKIE);
  if (existingCookie?.value) {
    return NextResponse.next();
  }

  // Resolver tenant via API do backend
  const host = request.headers.get("host") ?? "";

  try {
    const response = await fetch(`${BACKEND_URL}/v1/public/tenants/resolve?domain=${host}`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      // Se nao conseguir resolver tenant, continua sem cookie
      return NextResponse.next();
    }

    const data = await response.json();
    if (!data.found || !data.tenant) {
      return NextResponse.next();
    }
    const tenantValue = Buffer.from(JSON.stringify(data.tenant)).toString("base64");

    const res = NextResponse.next();
    res.cookies.set(TENANT_COOKIE, tenantValue, {
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      httpOnly: false,
      sameSite: "lax"
    });

    return res;
  } catch {
    // Em caso de erro, continua sem tenant
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
