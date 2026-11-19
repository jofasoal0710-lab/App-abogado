CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"system_key" text,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name"),
	CONSTRAINT "roles_system_key_unique" UNIQUE("system_key")
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Los tres roles fijos pasan a ser roles de sistema con los mismos permisos que tenían.
INSERT INTO "roles" ("name", "description", "system_key", "permissions") VALUES
  ('Administrador', 'Acceso completo. No se puede modificar ni eliminar.', 'admin', ARRAY['expedientes.ver_restringidos', 'expedientes.gestionar_acceso', 'expedientes.borrar', 'notas.borrar_todas', 'clientes.gestionar', 'clientes.gestionar_todos', 'documentos.borrar', 'horas.borrar_todas', 'facturacion.ver', 'facturacion.cobros', 'facturacion.emitir', 'facturacion.exportar', 'equipo.gestionar', 'seguridad.ver', 'recordatorios.gestionar']::text[]),
  ('Abogado/a', 'Lleva expedientes y factura.', 'abogado', ARRAY['clientes.gestionar', 'documentos.borrar', 'facturacion.ver', 'facturacion.cobros', 'facturacion.emitir', 'facturacion.exportar']::text[]),
  ('Asistente', 'Apoyo administrativo: registra cobros pero no emite facturas ni borra.', 'asistente', ARRAY['facturacion.ver', 'facturacion.cobros']::text[]);--> statement-breakpoint
UPDATE "users" SET "role_id" = (SELECT "id" FROM "roles" WHERE "system_key" = "users"."role"::text);
