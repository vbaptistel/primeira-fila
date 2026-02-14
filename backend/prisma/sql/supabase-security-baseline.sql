-- Baseline de segurança para PostgreSQL no Supabase (MVP).
-- Este roteiro deve ser executado no SQL Editor com papel administrativo.
-- Ajuste os placeholders antes de executar:
--   <APP_ROLE>: role de runtime usada pelo backend
--   <APP_PASSWORD>: senha forte gerenciada como segredo na Vercel

-- 1) Reduzir privilégios amplos padrão
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- 2) Habilitar RLS em tabelas já existentes no schema public
DO $$
DECLARE
  target_table RECORD;
BEGIN
  FOR target_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target_table.tablename);
  END LOOP;
END;
$$;

-- 3) Aplicar política automática para novas tabelas em public:
--    - revoke para anon/authenticated
--    - ENABLE + FORCE RLS
CREATE OR REPLACE FUNCTION public.enforce_public_table_security()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  command_row RECORD;
  table_row RECORD;
BEGIN
  FOR command_row IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF command_row.object_type IN ('table', 'partitioned table')
       AND command_row.schema_name = 'public' THEN
      SELECT n.nspname AS schema_name, c.relname AS table_name
      INTO table_row
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.oid = command_row.objid;

      IF table_row.table_name IS NOT NULL THEN
        EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon, authenticated', table_row.schema_name, table_row.table_name);
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', table_row.schema_name, table_row.table_name);
        EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', table_row.schema_name, table_row.table_name);
      END IF;
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS trg_enforce_public_table_security;
CREATE EVENT TRIGGER trg_enforce_public_table_security
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
EXECUTE FUNCTION public.enforce_public_table_security();

-- 4) Criar role de aplicação com privilégio mínimo (exemplo)
-- CREATE ROLE <APP_ROLE> LOGIN PASSWORD '<APP_PASSWORD>';
-- ALTER ROLE <APP_ROLE> NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

-- 5) Conceder apenas permissões necessárias no schema public (exemplo)
-- GRANT CONNECT ON DATABASE postgres TO <APP_ROLE>;
-- GRANT USAGE ON SCHEMA public TO <APP_ROLE>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO <APP_ROLE>;
-- GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO <APP_ROLE>;

-- 6) Garantir privilégios para futuros objetos (exemplo)
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO <APP_ROLE>;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO <APP_ROLE>;

-- 7) Recomendação operacional
-- Não usar role de administração no runtime do backend.
-- A conexão DATABASE_URL deve incluir sslmode=require.
