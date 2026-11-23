CREATE TYPE "public"."fund_kind" AS ENUM('deposito', 'gasto', 'aplicacion', 'devolucion');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'provision';--> statement-breakpoint
CREATE TABLE "matter_funds" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matter_funds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"matter_id" integer NOT NULL,
	"kind" "fund_kind" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"moved_on" date DEFAULT current_date NOT NULL,
	"description" text NOT NULL,
	"method" "payment_method",
	"reference" text,
	"expense_id" integer,
	"payment_id" integer,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matter_funds_amount_positive" CHECK ("matter_funds"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "matter_funds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "funds_min_cents" bigint;--> statement-breakpoint
ALTER TABLE "matter_funds" ADD CONSTRAINT "matter_funds_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_funds" ADD CONSTRAINT "matter_funds_expense_id_matter_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."matter_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_funds" ADD CONSTRAINT "matter_funds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_funds" ADD CONSTRAINT "matter_funds_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matter_funds_matter_idx" ON "matter_funds" USING btree ("matter_id");--> statement-breakpoint
CREATE TRIGGER audit_delete AFTER DELETE ON matter_funds FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
CREATE TRIGGER audit_update AFTER UPDATE ON matter_funds FOR EACH ROW EXECUTE FUNCTION audit_row_change();
