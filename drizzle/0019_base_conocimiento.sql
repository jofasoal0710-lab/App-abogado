CREATE TABLE "knowledge_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"body" text NOT NULL,
	"area" text DEFAULT 'general' NOT NULL,
	"keywords" text,
	"refs" text,
	"source" text DEFAULT 'despacho' NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_entries_area_idx" ON "knowledge_entries" USING btree ("area");--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('spanish', coalesce("title", '')), 'A') || setweight(to_tsvector('spanish', coalesce("keywords", '')), 'A') || setweight(to_tsvector('spanish', "body"), 'B')) STORED;--> statement-breakpoint
CREATE INDEX "knowledge_entries_search_idx" ON "knowledge_entries" USING gin ("search");
