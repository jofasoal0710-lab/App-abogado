CREATE TABLE "matter_citations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matter_citations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"matter_id" integer NOT NULL,
	"norm_key" text,
	"norm_name" text NOT NULL,
	"norm_number" text,
	"articles" text,
	"note" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matter_citations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matter_citations" ADD CONSTRAINT "matter_citations_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_citations" ADD CONSTRAINT "matter_citations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matter_citations_matter_idx" ON "matter_citations" USING btree ("matter_id");