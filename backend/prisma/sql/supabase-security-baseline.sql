-- Baseline de seguranca para PostgreSQL no Supabase (MVP).
-- Este roteiro deve ser executado no SQL Editor com papel administrativo.
-- Ajuste os placeholders antes de executar:
--   <APP_ROLE>: role de runtime usada pelo backend
--   <APP_PASSWORD>: senha forte gerenciada como segredo na Vercel

-- 1) Reduzir privilegios amplos padrao
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- 2) Criar role de aplicacao com privilegio minimo (exemplo)
-- CREATE ROLE <APP_ROLE> LOGIN PASSWORD '<APP_PASSWORD>';
-- ALTER ROLE <APP_ROLE> NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

-- 3) Conceder apenas permissoes necessarias no schema public (exemplo)
-- GRANT CONNECT ON DATABASE postgres TO <APP_ROLE>;
-- GRANT USAGE ON SCHEMA public TO <APP_ROLE>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO <APP_ROLE>;
-- GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO <APP_ROLE>;

-- 4) Garantir privilegios para futuros objetos (exemplo)
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO <APP_ROLE>;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO <APP_ROLE>;

-- 5) Recomendacao operacional
-- Nao usar role de administracao no runtime do backend.
-- A conexao DATABASE_URL deve incluir sslmode=require.
