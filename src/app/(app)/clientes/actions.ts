"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clients, invoices, matters } from "@/db/schema";
import { getAccessibleClient } from "@/lib/access";
import { reassignLostAccessEvents } from "@/lib/access-effects";
import { logAccessChange, logClientAccessChange } from "@/lib/access-log";
import { CLIENT_ACCESS_DENIED, describeVisibility } from "@/lib/access-rules";
import { firstZodError, optStr, str, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { stampSessionActor, asSessionActor, asActor } from "@/lib/data-audit";

import { parseClient } from "@/lib/client-parse";

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseClient(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  // Solo con el permiso «gestionar clientes» se puede dar de alta un cliente confidencial.
  const visibility = str(formData, "visibility") === "confidencial" && can(user, "clientes.gestionar") ? "confidencial" : "abierto";
  const row = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    const [created] = await tx.insert(clients).values({ ...parsed.data, visibility, createdById: user.id }).returning({ id: clients.id });
    if (visibility === "confidencial") await logClientAccessChange(created.id, user.id, "Cliente creado como confidencial", tx);
    return created;
  });
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

  await asSessionActor((tx) => tx.update(clients).set(parsed.data).where(eq(clients.id, id)));
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function deleteClientAction(id: number) {
  const user = await requireUser();
  if (!(await getAccessibleClient(user, id))) redirect("/clientes");
  if (!can(user, "clientes.gestionar")) redirect(`/clientes/${id}?error=forbidden`);

  const [{ m }] = await db.select({ m: count() }).from(matters).where(eq(matters.clientId, id));
  const [{ i }] = await db.select({ i: count() }).from(invoices).where(eq(invoices.clientId, id));
  if (m > 0 || i > 0) redirect(`/clientes/${id}?error=in_use`);

  await asActor(user.id, (tx) => tx.delete(clients).where(eq(clients.id, id)));
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
  if (!(can(user, "clientes.gestionar_todos") || (can(user, "clientes.gestionar") && client.createdById === user.id))) {
    return { error: "Solo quien dio de alta al cliente o un administrador con acceso puede cambiar su confidencialidad." };
  }
  const target = str(formData, "visibility") === "confidencial" ? "confidencial" : "abierto";
  if (target === client.visibility) return { ok: "Sin cambios." };

  // Todo o nada: el cliente, sus expedientes abiertos, el historial y la reasignación de eventos.
  const converted = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx.update(clients).set({ visibility: target }).where(eq(clients.id, clientId));
    await logClientAccessChange(clientId, user.id, target === "confidencial" ? "Cliente marcado como confidencial" : "Cliente ya no es confidencial", tx);
    let n = 0;
    if (target === "confidencial") {
      const open = await tx.select({ id: matters.id }).from(matters).where(and(eq(matters.clientId, clientId), eq(matters.visibility, "abierto")));
      for (const m of open) {
        await tx.update(matters).set({ visibility: "restringido" }).where(eq(matters.id, m.id));
        await logAccessChange(m.id, user.id, "visibilidad", `Visibilidad: ${describeVisibility("restringido")} (el cliente pasó a ser confidencial)`, tx);
        await reassignLostAccessEvents(m.id, user.id, tx);
        n++;
      }
    }
    return n;
  });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/expedientes");
  revalidatePath("/");
  return { ok: target === "confidencial" ? `Cliente confidencial.${converted ? ` ${converted} expediente(s) abierto(s) pasaron a restringido.` : ""}` : "El cliente ya no es confidencial. Sus expedientes conservan su visibilidad actual." };
}
