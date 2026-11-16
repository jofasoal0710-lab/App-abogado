"use server";

import { z } from "zod";
import { getAccessibleClient, getAccessibleMatter } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { logRead } from "@/lib/read-audit";

const schema = z.object({
  matterId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  // Las descargas solo se registran en el servidor (ruta de descarga); aquí solo vistas de pantalla.
  kind: z.enum(["ficha", "factura", "cliente"]),
  detail: z.string().min(1).max(200),
});

/** Lo invoca la baliza de cliente cuando una pantalla se muestra de verdad. Solo registra si hay acceso. */
export async function recordReadAction(input: z.input<typeof schema>): Promise<void> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return;
  const { matterId, clientId, kind, detail } = parsed.data;
  // No se registra (ni se confirma nada) sobre lo que el usuario no puede ver.
  if (matterId !== undefined && !(await getAccessibleMatter(user, matterId))) return;
  if (matterId === undefined && clientId !== undefined && !(await getAccessibleClient(user, clientId))) return;
  await logRead(user, { matterId, clientId, kind, detail });
}
