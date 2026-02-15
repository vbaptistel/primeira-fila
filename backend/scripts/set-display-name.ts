/**
 * Script para definir o display name (nome de exibição) de um usuário no Supabase Auth.
 * Atualiza user_metadata.full_name, usado pelo Supabase para exibir o nome do usuário.
 *
 * Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env do backend.
 *
 * Uso:
 *   npm run script:set-display-name -- --email usuario@exemplo.com --display-name "João Silva"
 *   npm run script:set-display-name -- --user-id <uuid> --display-name "Maria Santos"
 */

import "../src/config/load-env";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(): { email?: string; userId?: string; displayName?: string } {
  const args = process.argv.slice(2);
  const out: { email?: string; userId?: string; displayName?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      out.email = args[++i];
    } else if (args[i] === "--user-id" && args[i + 1]) {
      out.userId = args[++i];
    } else if (args[i] === "--display-name" && args[i + 1]) {
      out.displayName = args[++i];
    }
  }

  return out;
}

async function findUserByEmail(
  supabase: {
    auth: {
      admin: {
        listUsers: (opts: { page: number; perPage: number }) => Promise<{
          data: { users: { id: string; email?: string }[] };
          error: unknown;
        }>;
      };
    };
  },
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

  const { email, userId, displayName } = parseArgs();

  if (!displayName || displayName.trim().length === 0) {
    console.error("Informe --display-name com o nome de exibição.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let targetId: string | null = userId ?? null;
  if (!targetId && email) {
    targetId = await findUserByEmail(supabase, email);
    if (!targetId) {
      console.error("Usuário não encontrado com email:", email);
      process.exit(1);
    }
  }

  if (!targetId) {
    console.error("Informe --email (para buscar) ou --user-id (UUID do usuário no Supabase Auth).");
    process.exit(1);
  }

  const user_metadata = { full_name: displayName.trim() };
  const { data, error } = await supabase.auth.admin.updateUserById(targetId, { user_metadata });
  if (error) {
    console.error("Erro ao atualizar usuário:", (error as { message?: string }).message ?? error);
    process.exit(1);
  }
  console.log("Usuário atualizado:", data.user?.id, data.user?.email);
  console.log("user_metadata.full_name:", displayName.trim());
}

main();
