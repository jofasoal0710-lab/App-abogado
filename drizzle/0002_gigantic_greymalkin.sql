CREATE TYPE "public"."access_action" AS ENUM('visibilidad', 'miembro_alta', 'miembro_baja', 'responsable');--> statement-breakpoint
CREATE TYPE "public"."matter_visibility" AS ENUM('abierto', 'restringido');--> statement-breakpoint
CREATE TABLE "matter_access_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matter_access_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"matter_id" integer NOT NULL,
	"actor_id" integer,
	"action" "access_action" NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matter_members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matter_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"matter_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"added_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "visibility" "matter_visibility" DEFAULT 'abierto' NOT NULL;--> statement-breakpoint
ALTER TABLE "matter_access_log" ADD CONSTRAINT "matter_access_log_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_access_log" ADD CONSTRAINT "matter_access_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_members" ADD CONSTRAINT "matter_members_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_members" ADD CONSTRAINT "matter_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_members" ADD CONSTRAINT "matter_members_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matter_access_log_matter_idx" ON "matter_access_log" USING btree ("matter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matter_members_unique_idx" ON "matter_members" USING btree ("matter_id","user_id");--> statement-breakpoint
CREATE INDEX "matter_members_user_idx" ON "matter_members" USING btree ("user_id");