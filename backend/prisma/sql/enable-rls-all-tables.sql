-- Habilitar RLS em todas as tabelas existentes do schema public
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END;
$$;

-- Event trigger: habilitar RLS automaticamente em tabelas futuras
CREATE OR REPLACE FUNCTION public.enforce_rls_on_new_table()
RETURNS event_trigger
LANGUAGE plpgsql AS $$
DECLARE
  obj RECORD;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE object_type = 'table'
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS trg_enforce_rls_on_new_tables;
CREATE EVENT TRIGGER trg_enforce_rls_on_new_tables
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS')
  EXECUTE FUNCTION public.enforce_rls_on_new_table();
