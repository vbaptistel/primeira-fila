import { getTenantCookieMaxAge, getTenantCookieName } from "@/lib/tenant";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TENANT_COOKIE = getTenantCookieName();
const COOKIE_MAX_AGE = getTenantCookieMaxAge();

function return404(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

function setTenantCookieAndNext(tenant: unknown): NextResponse {
  const tenantValue = Buffer.from(JSON.stringify(tenant)).toString("base64");
  const res = NextResponse.next();
  res.cookies.set(TENANT_COOKIE, tenantValue, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    httpOnly: false,
    sameSite: "lax"
  });
  return res;
}

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

  const host = request.headers.get("host") ?? "";
  const isLocalhost = host.startsWith("localhost");
  const devTenantId = process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim();

  // Excecao para dev local: localhost + DEV_TENANT_ID definido
  if (isLocalhost && devTenantId) {
    try {
      const response = await fetch(`${BACKEND_URL}/v1/public/tenants/by-id/${devTenantId}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.tenant) {
          return setTenantCookieAndNext(data.tenant);
        }
      }
    } catch {
      // Falha ao obter tenant de dev, prossegue para 404
    }
  }

  try {
    const response = await fetch(`${BACKEND_URL}/v1/public/tenants/resolve?domain=${host}`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      return return404();
    }

    const data = await response.json();
    if (!data.found || !data.tenant) {
      return return404();
    }

    return setTenantCookieAndNext(data.tenant);
  } catch {
    return return404();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
