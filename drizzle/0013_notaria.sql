CREATE TYPE "public"."deed_status" AS ENUM('otorgada', 'no_paso');--> statement-breakpoint
CREATE TABLE "deed_parties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deed_parties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"deed_id" integer NOT NULL,
	"name" text NOT NULL,
	"id_number" text,
	"role" text NOT NULL,
	"signed_on" date
);
--> statement-breakpoint
ALTER TABLE "deed_parties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deeds" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deeds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"notary_id" integer NOT NULL,
	"number" integer NOT NULL,
	"volume" text,
	"folio_start" integer,
	"folio_end" integer,
	"granted_on" date NOT NULL,
	"granted_at" text,
	"act" text NOT NULL,
	"status" "deed_status" DEFAULT 'otorgada' NOT NULL,
	"notes" text,
	"writing_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deeds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notary_profiles" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"id_number" text,
	"bar_number" text,
	"office" text,
	"phone" text,
	"email" text,
	"current_volume" text,
	"next_folio" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notary_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "testimonies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "testimonies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"deed_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"issued_on" date NOT NULL,
	"issued_to" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "testimonies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deed_parties" ADD CONSTRAINT "deed_parties_deed_id_deeds_id_fk" FOREIGN KEY ("deed_id") REFERENCES "public"."deeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deeds" ADD CONSTRAINT "deeds_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deeds" ADD CONSTRAINT "deeds_writing_id_writings_id_fk" FOREIGN KEY ("writing_id") REFERENCES "public"."writings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notary_profiles" ADD CONSTRAINT "notary_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonies" ADD CONSTRAINT "testimonies_deed_id_deeds_id_fk" FOREIGN KEY ("deed_id") REFERENCES "public"."deeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deeds_notary_number_idx" ON "deeds" USING btree ("notary_id","number");--> statement-breakpoint
CREATE INDEX "deeds_granted_idx" ON "deeds" USING btree ("notary_id","granted_on");--> statement-breakpoint
-- El rol de sistema «Abogado/a» puede usar el gestor notarial (el Administrador ya lo tiene todo).
UPDATE "roles" SET "permissions" = array_append("permissions", 'notaria.usar') WHERE "system_key" = 'abogado' AND NOT ('notaria.usar' = ANY("permissions"));
