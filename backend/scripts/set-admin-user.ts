/**
 * Script para criar ou atualizar usuário no Supabase Auth e definir app_metadata
 * (role e tenant_id) para RBAC do backend.
 *
 * Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env do backend.
 *
 * Uso:
 *   npm run script:set-admin -- --email admin@exemplo.com --role platform_admin
 *   npm run script:set-admin -- --email org@tenant.com --role organizer_admin --tenant-id <uuid>
 *   npm run script:set-admin -- --user-id <uuid> --role platform_admin
 *   npm run script:set-admin -- --email novo@exemplo.com --password senha123 --role platform_admin
 *
 * Roles: platform_admin | organizer_admin | operator | buyer
 */

import "../src/config/load-env";
import { createClient } from "@supabase/supabase-js";
import { APP_ROLES, type AppRole } from "../src/common/auth/auth.types";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(): {
  email?: string;
  userId?: string;
  role?: AppRole;
  tenantId?: string;
  password?: string;
} {
  const args = process.argv.slice(2);
  const out: { email?: string; userId?: string; role?: AppRole; tenantId?: string; password?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      out.email = args[++i];
    } else if (args[i] === "--user-id" && args[i + 1]) {
      out.userId = args[++i];
    } else if (args[i] === "--role" && args[i + 1]) {
      const r = args[++i].trim().toLowerCase();
      if (APP_ROLES.includes(r as AppRole)) {
        out.role = r as AppRole;
      } else {
        console.error("Role inválida. Use uma de:", APP_ROLES.join(", "));
        process.exit(1);
      }
    } else if (args[i] === "--tenant-id" && args[i + 1]) {
      out.tenantId = args[++i];
    } else if (args[i] === "--password" && args[i + 1]) {
      out.password = args[++i];
    }
  }

  return out;
}

async function findUserByEmail(
  supabase: { auth: { admin: { listUsers: (opts: { page: number; perPage: number }) => Promise<{ data: { users: { id: string; email?: string }[] }; error: unknown }> } } },
  email: string
): Promise<string | null> {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Erro ao listar usuários:", (error as { message?: string }).message ?? error);
      throw error;
    }
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user.id;
    if (data.users.length < perPage) break;
    page++;
  }

  return null;
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env do backend (variável service_role do projeto Supabase)."
    );
    process.exit(1);
  }

  const { email, userId, role, tenantId, password } = parseArgs();

  if (!role) {
    console.error("Informe --role (platform_admin | organizer_admin | operator | buyer).");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const appMetadata: Record<string, unknown> = { role };
  if (tenantId) appMetadata.tenant_id = tenantId;

  if (email && password) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: appMetadata
    });
    if (error) {
      console.error("Erro ao criar usuário:", error.message);
      process.exit(1);
    }
    console.log("Usuário criado:", data.user?.id, data.user?.email);
    console.log("app_metadata:", appMetadata);
    return;
  }

  let targetId: string | null = userId ?? null;
  if (!targetId && email) {
    targetId = await findUserByEmail(supabase, email);
    if (!targetId) {
      console.error("Usuário não encontrado com email:", email);
      process.exit(1);
    }
  }

  if (!targetId) {
    console.error("Informe --email (para buscar e atualizar) ou --user-id (UUID do usuário no Supabase Auth).");
    process.exit(1);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(targetId, { app_metadata: appMetadata });
  if (error) {
    console.error("Erro ao atualizar usuário:", error.message);
    process.exit(1);
  }
  console.log("Usuário atualizado:", data.user?.id, data.user?.email);
  console.log("app_metadata:", appMetadata);
}

main();
