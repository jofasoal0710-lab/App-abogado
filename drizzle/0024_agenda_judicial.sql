ALTER TABLE "events" ADD COLUMN "hearing_type" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "hearing_mode" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "meeting_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "calendar_token_hash" text;