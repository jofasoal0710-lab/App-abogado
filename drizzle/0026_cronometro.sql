CREATE TABLE "running_timers" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"matter_id" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone,
	"accumulated_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "running_timers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "running_timers" ADD CONSTRAINT "running_timers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "running_timers" ADD CONSTRAINT "running_timers_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;