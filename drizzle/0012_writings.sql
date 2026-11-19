CREATE TABLE "writings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "writings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"matter_id" integer,
	"template_key" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"values" jsonb NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "writings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bar_number" text;--> statement-breakpoint
ALTER TABLE "writings" ADD CONSTRAINT "writings_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writings" ADD CONSTRAINT "writings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "writings_matter_idx" ON "writings" USING btree ("matter_id");