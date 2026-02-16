-- Reversão do baseline de segurança (supabase-security-baseline.sql).
-- Executar no SQL Editor do Supabase com papel administrativo.
-- Restaura privilégios e desativa RLS no schema public para corrigir
-- erros como "permission denied for database postgres" (ex.: Storage e pooler).

-- 1) Remover event trigger e função que aplicavam RLS em novas tabelas
DROP EVENT TRIGGER IF EXISTS trg_enforce_public_table_security;
DROP FUNCTION IF EXISTS public.enforce_public_table_security();

-- 2) Restaurar privilégios no database postgres (evita "permission denied for database postgres")
GRANT CONNECT ON DATABASE postgres TO PUBLIC;

-- 3) Restaurar CREATE no schema public
GRANT CREATE ON SCHEMA public TO PUBLIC;

-- 4) Restaurar permissões em tabelas e sequências existentes no schema public (anon/authenticated)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 5) Restaurar default privileges para anon/authenticated em novos objetos
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO anon, authenticated;

-- 6) Desativar RLS e FORCE RLS em todas as tabelas do schema public
DO $$
DECLARE
  target_table RECORD;
BEGIN
  FOR target_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', target_table.tablename);
  END LOOP;
END;
$$;
