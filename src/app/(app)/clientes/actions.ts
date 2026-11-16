"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { clients, invoices, matters } from "@/db/schema";
import { getAccessibleClient } from "@/lib/access";
import { reassignLostAccessEvents } from "@/lib/access-effects";
import { logAccessChange, logClientAccessChange } from "@/lib/access-log";
import { CLIENT_ACCESS_DENIED, describeVisibility } from "@/lib/access-rules";
import { firstZodError, optStr, str, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth";

const clientSchema = z.object({
  type: z.enum(["persona", "empresa"]),
  name: z.string().min(2, "El nombre es obligatorio (mínimo 2 caracteres)").max(200),
  taxId: z.string().max(40).nullable(),
  email: z.union([z.literal(null), z.email("El correo electrónico no es válido")]),
  phone: z.string().max(40).nullable(),
  address: z.string().max(500).nullable(),
  notes: z.string().max(5000).nullable(),
});

function parseClient(formData: FormData) {
  return clientSchema.safeParse({
    type: str(formData, "type"),
    name: str(formData, "name"),
    taxId: optStr(formData, "taxId"),
    email: optStr(formData, "email"),
    phone: optStr(formData, "phone"),
    address: optStr(formData, "address"),
    notes: optStr(formData, "notes"),
  });
}

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseClient(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  // Solo administradores y abogados pueden dar de alta un cliente confidencial.
  const visibility = str(formData, "visibility") === "confidencial" && user.role !== "asistente" ? "confidencial" : "abierto";
  const [row] = await db.insert(clients).values({ ...parsed.data, visibility, createdById: user.id }).returning({ id: clients.id });
  if (visibility === "confidencial") await logClientAccessChange(row.id, user.id, "Cliente creado como confidencial");
  revalidatePath("/clientes");
  redirect(`/clientes/${row.id}`);
}

export async function updateClientAction(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!(await getAccessibleClient(user, id))) return { error: CLIENT_ACCESS_DENIED };
  const parsed = parseClient(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  await db.update(clients).set(parsed.data).where(eq(clients.id, id));
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function deleteClientAction(id: number) {
  const user = await requireUser();
  if (!(await getAccessibleClient(user, id))) redirect("/clientes");
  if (user.role === "asistente") redirect(`/clientes/${id}?error=forbidden`);

  const [{ m }] = await db.select({ m: count() }).from(matters).where(eq(matters.clientId, id));
  const [{ i }] = await db.select({ i: count() }).from(invoices).where(eq(invoices.clientId, id));
  if (m > 0 || i > 0) redirect(`/clientes/${id}?error=in_use`);

  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/clientes");
  redirect("/clientes");
}

/**
 * Cambia la confidencialidad de un cliente. Solo quien lo dio de alta o un administrador con acceso.
 * Al hacerlo confidencial, sus expedientes abiertos pasan a restringidos (un cliente confidencial no
 * admite expedientes abiertos) y los eventos de quien pierde acceso se reasignan.
 */
export async function setClientVisibilityAction(clientId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const client = await getAccessibleClient(user, clientId);
  if (!client) return { error: CLIENT_ACCESS_DENIED };
  if (user.role === "asistente" || !(user.role === "admin" || client.createdById === user.id)) {
    return { error: "Solo quien dio de alta al cliente o un administrador con acceso puede cambiar su confidencialidad." };
  }
  const target = str(formData, "visibility") === "confidencial" ? "confidencial" : "abierto";
  if (target === client.visibility) return { ok: "Sin cambios." };

  await db.update(clients).set({ visibility: target }).where(eq(clients.id, clientId));
  await logClientAccessChange(clientId, user.id, target === "confidencial" ? "Cliente marcado como confidencial" : "Cliente ya no es confidencial");

  let converted = 0;
  if (target === "confidencial") {
    const open = await db.select({ id: matters.id }).from(matters).where(and(eq(matters.clientId, clientId), eq(matters.visibility, "abierto")));
    for (const m of open) {
      await db.update(matters).set({ visibility: "restringido" }).where(eq(matters.id, m.id));
      await logAccessChange(m.id, user.id, "visibilidad", `Visibilidad: ${describeVisibility("restringido")} (el cliente pasó a ser confidencial)`);
      await reassignLostAccessEvents(m.id, user.id);
      converted++;
    }
  }
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/expedientes");
  revalidatePath("/");
  return { ok: target === "confidencial" ? `Cliente confidencial.${converted ? ` ${converted} expediente(s) abierto(s) pasaron a restringido.` : ""}` : "El cliente ya no es confidencial. Sus expedientes conservan su visibilidad actual." };
}
