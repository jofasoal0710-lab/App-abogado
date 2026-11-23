CREATE TABLE "backup_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "backup_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"storage_key" text,
	"bytes" bigint,
	"rows" integer,
	"ok" boolean NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "backup_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "data_audit" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "data_audit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"table_name" text NOT NULL,
	"op" text NOT NULL,
	"row_id" text,
	"actor_id" integer,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_recovery_hashes" jsonb;--> statement-breakpoint
CREATE INDEX "backup_runs_at_idx" ON "backup_runs" USING btree ("at");--> statement-breakpoint
CREATE INDEX "data_audit_at_idx" ON "data_audit" USING btree ("at");--> statement-breakpoint
CREATE INDEX "data_audit_row_idx" ON "data_audit" USING btree ("table_name","row_id");--> statement-breakpoint
-- SEC-004: registro de cambios y borrados con disparadores (cubre cualquier camino, también las cascadas).
CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  hidden text[] := ARRAY['password_hash','mfa_secret','mfa_recovery_hashes','updated_at','theme_mode','theme_palette','theme_sidebar'];
  o jsonb; n jsonb; diff jsonb := '{}'::jsonb; k text; actor integer;
BEGIN
  actor := nullif(current_setting('app.actor_id', true), '')::integer;
  o := to_jsonb(OLD) - hidden;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO data_audit (table_name, op, row_id, actor_id, data) VALUES (TG_TABLE_NAME, 'borrado', coalesce(o->>'id', o->>'user_id'), actor, o);
    RETURN OLD;
  END IF;
  n := to_jsonb(NEW) - hidden;
  FOR k IN SELECT jsonb_object_keys(n) LOOP
    IF (o->k) IS DISTINCT FROM (n->k) THEN diff := diff || jsonb_build_object(k, jsonb_build_array(o->k, n->k)); END IF;
  END LOOP;
  IF diff <> '{}'::jsonb THEN
    INSERT INTO data_audit (table_name, op, row_id, actor_id, data) VALUES (TG_TABLE_NAME, 'cambio', coalesce(n->>'id', n->>'user_id'), actor, diff);
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  -- Borrados: todas las tablas de negocio.
  FOREACH t IN ARRAY ARRAY['clients','deed_parties','deeds','documents','einvoice_settings','einvoices','events','fee_services','fee_settings','invoice_items','invoices','knowledge_entries','matter_citations','matter_expenses','matter_fee_stages','matter_members','matter_notes','matters','notary_index_submissions','notary_profiles','payments','registry_checks','roles','testimonies','time_entries','users','writings'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_delete ON %I', t);
    EXECUTE format('CREATE TRIGGER audit_delete AFTER DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t);
  END LOOP;
  -- Modificaciones: lo que tiene valor de prueba (no las tablas técnicas ni la factura electrónica, que guarda XML).
  FOREACH t IN ARRAY ARRAY['clients','deed_parties','deeds','documents','events','fee_services','invoice_items','invoices','matter_expenses','matter_fee_stages','matter_members','matters','notary_profiles','payments','roles','testimonies','time_entries','users','writings'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_update ON %I', t);
    EXECUTE format('CREATE TRIGGER audit_update AFTER UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- El registro no se puede modificar, y solo se borra lo que supera el año de conservación.
CREATE OR REPLACE FUNCTION data_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'El registro de cambios no se puede modificar'; END IF;
  IF OLD.at > now() - interval '365 days' THEN RAISE EXCEPTION 'El registro de cambios se conserva un año'; END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER data_audit_guard BEFORE UPDATE OR DELETE ON data_audit FOR EACH ROW EXECUTE FUNCTION data_audit_guard();
--> statement-breakpoint
-- SEC-010: en Supabase, quitar a los roles de la API pública (anon, authenticated) todo permiso sobre las
-- tablas; RLS ya las bloquea, esto es una segunda barrera. En PostgreSQL normal esos roles no existen.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      BEGIN
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;
