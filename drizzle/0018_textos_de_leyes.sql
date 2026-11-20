CREATE TABLE "law_articles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "law_articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"law_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"number" text NOT NULL,
	"heading" text,
	"body" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "law_articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "law_texts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "law_texts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"norm_key" text NOT NULL,
	"title" text NOT NULL,
	"version_label" text,
	"source_url" text,
	"retrieved_on" date NOT NULL,
	"article_count" integer DEFAULT 0 NOT NULL,
	"loaded_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "law_texts_norm_key_unique" UNIQUE("norm_key")
);
--> statement-breakpoint
ALTER TABLE "law_texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "law_articles" ADD CONSTRAINT "law_articles_law_id_law_texts_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."law_texts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_texts" ADD CONSTRAINT "law_texts_loaded_by_id_users_id_fk" FOREIGN KEY ("loaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "law_articles_law_idx" ON "law_articles" USING btree ("law_id","ordinal");--> statement-breakpoint
CREATE INDEX "law_articles_number_idx" ON "law_articles" USING btree ("law_id","number");--> statement-breakpoint
ALTER TABLE "law_articles" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (to_tsvector('spanish', coalesce("number", '') || ' ' || coalesce("heading", '') || ' ' || "body")) STORED;--> statement-breakpoint
CREATE INDEX "law_articles_search_idx" ON "law_articles" USING gin ("search");
