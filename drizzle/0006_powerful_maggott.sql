CREATE TYPE "public"."invoice_kind" AS ENUM('factura', 'rectificativa');--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "withholding_rate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "kind" "invoice_kind" DEFAULT 'factura' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "rectifies_invoice_id" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "rectification_reason" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "release_hours" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rectifies_invoice_id_invoices_id_fk" FOREIGN KEY ("rectifies_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;