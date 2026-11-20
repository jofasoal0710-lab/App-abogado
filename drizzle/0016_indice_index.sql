CREATE TABLE "notary_index_submissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notary_index_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"notary_id" integer NOT NULL,
	"period" text NOT NULL,
	"submitted_on" date NOT NULL,
	"receipt" text,
	"deed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notary_index_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notary_index_submissions" ADD CONSTRAINT "notary_index_submissions_notary_id_users_id_fk" FOREIGN KEY ("notary_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notary_index_submissions_uq" ON "notary_index_submissions" USING btree ("notary_id","period");