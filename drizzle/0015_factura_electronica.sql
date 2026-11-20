CREATE TYPE "public"."einvoice_status" AS ENUM('enviando', 'recibido', 'procesando', 'aceptado', 'rechazado', 'no_recibido');--> statement-breakpoint
CREATE TABLE "einvoice_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"id_type" text NOT NULL,
	"id_number" text NOT NULL,
	"commercial_name" text,
	"email" text NOT NULL,
	"phone" text,
	"province" text NOT NULL,
	"canton" text NOT NULL,
	"district" text NOT NULL,
	"other_signs" text NOT NULL,
	"activity_code" text NOT NULL,
	"branch" text DEFAULT '001' NOT NULL,
	"terminal" text DEFAULT '00001' NOT NULL,
	"default_cabys" text NOT NULL,
	"payment_method" text DEFAULT '04' NOT NULL,
	"provider_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "einvoice_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "einvoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "einvoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"environment" text NOT NULL,
	"doc_type" text NOT NULL,
	"branch" text NOT NULL,
	"terminal" text NOT NULL,
	"sequence" integer NOT NULL,
	"consecutive" text NOT NULL,
	"clave" text NOT NULL,
	"issued_at" text NOT NULL,
	"total_cents" integer NOT NULL,
	"status" "einvoice_status" DEFAULT 'enviando' NOT NULL,
	"signed_xml" text NOT NULL,
	"response_xml" text,
	"message" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_at" timestamp with time zone,
	CONSTRAINT "einvoices_clave_unique" UNIQUE("clave")
);
--> statement-breakpoint
ALTER TABLE "einvoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "cabys" text;--> statement-breakpoint
ALTER TABLE "einvoices" ADD CONSTRAINT "einvoices_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einvoices" ADD CONSTRAINT "einvoices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "einvoices_invoice_idx" ON "einvoices" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "einvoices_sequence_uq" ON "einvoices" USING btree ("environment","doc_type","branch","terminal","sequence");