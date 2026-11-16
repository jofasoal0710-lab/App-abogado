CREATE TYPE "public"."client_visibility" AS ENUM('abierto', 'confidencial');--> statement-breakpoint
CREATE TYPE "public"."read_kind" AS ENUM('ficha', 'documento', 'factura', 'cliente');--> statement-breakpoint
ALTER TYPE "public"."access_action" ADD VALUE 'reclamacion';--> statement-breakpoint
ALTER TYPE "public"."matter_visibility" ADD VALUE 'confidencial';--> statement-breakpoint
CREATE TABLE "client_access_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "client_access_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer NOT NULL,
	"actor_id" integer,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "read_audit" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "read_audit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"matter_id" integer,
	"client_id" integer,
	"kind" "read_kind" NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "visibility" "client_visibility" DEFAULT 'abierto' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "created_by_id" integer;--> statement-breakpoint
ALTER TABLE "client_access_log" ADD CONSTRAINT "client_access_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_access_log" ADD CONSTRAINT "client_access_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_audit" ADD CONSTRAINT "read_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_audit" ADD CONSTRAINT "read_audit_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_audit" ADD CONSTRAINT "read_audit_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_access_log_client_idx" ON "client_access_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "read_audit_matter_idx" ON "read_audit" USING btree ("matter_id","created_at");--> statement-breakpoint
CREATE INDEX "read_audit_client_idx" ON "read_audit" USING btree ("client_id","created_at");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;