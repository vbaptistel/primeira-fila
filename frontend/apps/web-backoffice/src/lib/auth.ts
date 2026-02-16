import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

export type SessionData = {
  userId: string;
  email: string;
  accessToken: string;
  tenantId: string;
};

function extractTenantId(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): string | null {
  const meta = user.app_metadata ?? {};
  const tenantId = meta["tenant_id"] ?? meta["tenantId"] ?? null;
  if (typeof tenantId === "string") return tenantId;
  return null;
}

export async function getSession(): Promise<SessionData | null> {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // getUser() validates the token server-side but doesn't return
  // the access_token — we still need getSession() for that.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const tenantId = extractTenantId(user) ?? process.env.NEXT_PUBLIC_TENANT_ID ?? null;
  if (!tenantId) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    accessToken: session.access_token,
    tenantId
  };
}

export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
