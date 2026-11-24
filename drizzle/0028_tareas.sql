CREATE TYPE "public"."task_priority" AS ENUM('baja', 'normal', 'alta', 'urgente');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pendiente', 'en_curso', 'hecha');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "status" "task_status" DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "priority" "task_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "created_by_id" integer;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "events" SET "status" = 'hecha', "completed_at" = "created_at" WHERE "completed";
