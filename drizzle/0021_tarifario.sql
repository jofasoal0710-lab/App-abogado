CREATE TYPE "public"."expense_kind" AS ENUM('timbre', 'registro', 'gasto', 'viaticos');--> statement-breakpoint
CREATE TYPE "public"."fee_mode" AS ENUM('fijo', 'horas', 'porcentaje', 'arancel');--> statement-breakpoint
CREATE TABLE "fee_services" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fee_services_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"area" text DEFAULT 'abogacia' NOT NULL,
	"mode" "fee_mode" DEFAULT 'fijo' NOT NULL,
	"amount_cents" bigint,
	"hourly_rate_cents" integer,
	"percent_bp" integer,
	"minimum_cents" bigint,
	"markup_bp" integer DEFAULT 0 NOT NULL,
	"arancel_key" text,
	"stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fee_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"arancel_adjust_bp" integer DEFAULT 0 NOT NULL,
	"arancel_adjust_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fee_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matter_expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matter_expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"matter_id" integer NOT NULL,
	"kind" "expense_kind" DEFAULT 'gasto' NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"spent_on" date DEFAULT current_date NOT NULL,
	"reimbursed_at" date,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matter_expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matter_fee_stages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matter_fee_stages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"matter_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"invoice_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matter_fee_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "unit_price_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "matters" ALTER COLUMN "fixed_fee_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "amount_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "fee_stage_id" integer;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "service_id" integer;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "fee_base_cents" bigint;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "suggested_fee_cents" bigint;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "hourly_rate_cents" integer;--> statement-breakpoint
ALTER TABLE "matter_expenses" ADD CONSTRAINT "matter_expenses_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_expenses" ADD CONSTRAINT "matter_expenses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_fee_stages" ADD CONSTRAINT "matter_fee_stages_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_fee_stages" ADD CONSTRAINT "matter_fee_stages_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matter_expenses_matter_idx" ON "matter_expenses" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "matter_fee_stages_matter_idx" ON "matter_fee_stages" USING btree ("matter_id");--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_fee_stage_id_matter_fee_stages_id_fk" FOREIGN KEY ("fee_stage_id") REFERENCES "public"."matter_fee_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matters" ADD CONSTRAINT "matters_service_id_fee_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."fee_services"("id") ON DELETE set null ON UPDATE no action;