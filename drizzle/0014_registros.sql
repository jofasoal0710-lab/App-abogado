CREATE TABLE "registry_checks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "registry_checks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer,
	"matter_id" integer,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"reference" text NOT NULL,
	"result" text,
	"birth_date" date,
	"marital_status" text,
	"deceased" boolean,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registry_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry_checks" ADD CONSTRAINT "registry_checks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registry_checks" ADD CONSTRAINT "registry_checks_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registry_checks" ADD CONSTRAINT "registry_checks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registry_checks_client_idx" ON "registry_checks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "registry_checks_matter_idx" ON "registry_checks" USING btree ("matter_id");