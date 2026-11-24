CREATE TABLE "doc_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doc_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_templates_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "doc_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "doc_templates" ADD CONSTRAINT "doc_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER audit_delete AFTER DELETE ON doc_templates FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
CREATE TRIGGER audit_update AFTER UPDATE ON doc_templates FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
-- El rol «Abogado/a» (preset) recibe el permiso nuevo, como en los roles de partida.
UPDATE "roles" SET "permissions" = array_append("permissions", 'plantillas.gestionar') WHERE "name" = 'Abogado/a' AND NOT ('plantillas.gestionar' = ANY("permissions"));
