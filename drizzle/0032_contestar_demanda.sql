CREATE TABLE "demand_analyses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "demand_analyses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"matter_id" integer NOT NULL,
	"document_id" integer,
	"source_name" text NOT NULL,
	"text" text NOT NULL,
	"analysis" jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"writing_id" integer,
	"event_id" integer,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "demand_analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "demand_analyses" ADD CONSTRAINT "demand_analyses_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_analyses" ADD CONSTRAINT "demand_analyses_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_analyses" ADD CONSTRAINT "demand_analyses_writing_id_writings_id_fk" FOREIGN KEY ("writing_id") REFERENCES "public"."writings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_analyses" ADD CONSTRAINT "demand_analyses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_analyses" ADD CONSTRAINT "demand_analyses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demand_analyses_matter_idx" ON "demand_analyses" USING btree ("matter_id");--> statement-breakpoint
CREATE TRIGGER audit_delete AFTER DELETE ON demand_analyses FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
CREATE TRIGGER audit_update AFTER UPDATE ON demand_analyses FOR EACH ROW EXECUTE FUNCTION audit_row_change();
