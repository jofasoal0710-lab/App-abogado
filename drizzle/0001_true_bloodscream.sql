CREATE TYPE "public"."reminder_status" AS ENUM('enviado', 'error');--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reminder_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" integer NOT NULL,
	"event_date" date NOT NULL,
	"offset_days" integer NOT NULL,
	"user_id" integer,
	"email" text NOT NULL,
	"status" "reminder_status" NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_log_unique_idx" ON "reminder_log" USING btree ("event_id","event_date","offset_days");--> statement-breakpoint
CREATE INDEX "reminder_log_created_idx" ON "reminder_log" USING btree ("created_at");