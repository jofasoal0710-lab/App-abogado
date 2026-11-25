CREATE TABLE "intake_files" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "intake_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" integer NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intake_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "intake_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intake_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "intake_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"status" text DEFAULT 'pendiente' NOT NULL,
	"client_type" "client_type" DEFAULT 'persona' NOT NULL,
	"name" text NOT NULL,
	"id_type" text,
	"tax_id" text,
	"birth_date" date,
	"marital_status" text,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"area" "matter_area" DEFAULT 'otros' NOT NULL,
	"summary" text NOT NULL,
	"opposing_party" text,
	"deadline" date,
	"preferred_contact" text,
	"consent_at" timestamp with time zone NOT NULL,
	"reviewed_by_id" integer,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"conflict_summary" text,
	"client_id" integer,
	"matter_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intake_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intake_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"intro" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intake_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "intake_files" ADD CONSTRAINT "intake_files_request_id_intake_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."intake_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intake_files_request_idx" ON "intake_files" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "intake_requests_status_idx" ON "intake_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE TRIGGER audit_delete AFTER DELETE ON intake_requests FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
CREATE TRIGGER audit_update AFTER UPDATE ON intake_requests FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
CREATE TRIGGER audit_delete AFTER DELETE ON intake_files FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
INSERT INTO "intake_settings" ("id", "enabled") VALUES (1, false) ON CONFLICT DO NOTHING;--> statement-breakpoint
-- El rol «Abogado/a» (preset) recibe el permiso nuevo, como en los roles de partida.
UPDATE "roles" SET "permissions" = array_append("permissions", 'solicitudes.gestionar') WHERE "name" = 'Abogado/a' AND NOT ('solicitudes.gestionar' = ANY("permissions"));
