"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clients, registryChecks } from "@/db/schema";
import { firstZodError, optStr, str, type ActionState } from "@/lib/actions";
import { getAccessibleClient, getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED, CLIENT_ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { MARITAL_STATUS, type MaritalStatus } from "@/lib/cr-id";
import { todayISO } from "@/lib/dates";
import { isRegistryKind, isRegistrySource } from "@/lib/registries";

const schema = z.object({
  source: z.string().refine(isRegistrySource, "Elige el registro consultado"),
  kind: z.string().refine(isRegistryKind, "Elige qué se consultó"),
  reference: z.string().trim().min(1, "Indica la cédula, finca, placa o referencia consultada").max(120),
  result: z.string().max(5000).nullable(),
  birthDate: z.iso.date("Fecha de nacimiento no válida").nullable(),
  maritalStatus: z.enum(Object.keys(MARITAL_STATUS) as [MaritalStatus, ...MaritalStatus[]]).nullable(),
  deceased: z.boolean(),
});

/** Anota una consulta hecha en el TSE o el Registro Nacional (en un cliente o en un expediente). */
export async function addRegistryCheckAction(target: { clientId?: number; matterId?: number }, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (target.clientId && !(await getAccessibleClient(user, target.clientId))) return { error: CLIENT_ACCESS_DENIED };
  if (target.matterId && !(await getAccessibleMatter(user, target.matterId))) return { error: ACCESS_DENIED };
  const parsed = schema.safeParse({
    source: str(formData, "source"),
    kind: str(formData, "kind"),
    reference: str(formData, "reference"),
    result: optStr(formData, "result"),
    birthDate: optStr(formData, "birthDate"),
    maritalStatus: optStr(formData, "maritalStatus"),
    deceased: formData.get("deceased") === "on",
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  if (parsed.data.birthDate && parsed.data.birthDate > todayISO()) return { error: "La fecha de nacimiento no puede ser futura." };
  await db.insert(registryChecks).values({ ...parsed.data, clientId: target.clientId ?? null, matterId: target.matterId ?? null, createdById: user.id });
  revalidatePath(target.clientId ? `/clientes/${target.clientId}` : `/expedientes/${target.matterId}`);
  return { ok: "Consulta anotada." };
}

/** Pasa a la ficha del cliente la fecha de nacimiento y el estado civil verificados en el TSE. */
export async function applyCheckToClientAction(checkId: number, clientId: number) {
  const user = await requireUser();
  if (!(await getAccessibleClient(user, clientId))) return;
  const [c] = await db.select().from(registryChecks).where(and(eq(registryChecks.id, checkId), eq(registryChecks.clientId, clientId)));
  if (!c) return;
  const set: Partial<typeof clients.$inferInsert> = {};
  if (c.birthDate) set.birthDate = c.birthDate;
  if (c.maritalStatus) set.maritalStatus = c.maritalStatus;
  if (Object.keys(set).length) await db.update(clients).set(set).where(eq(clients.id, clientId));
  revalidatePath(`/clientes/${clientId}`);
}

export async function deleteRegistryCheckAction(checkId: number, target: { clientId?: number; matterId?: number }) {
  const user = await requireUser();
  if (target.clientId && !(await getAccessibleClient(user, target.clientId))) return;
  if (target.matterId && !(await getAccessibleMatter(user, target.matterId))) return;
  await db
    .delete(registryChecks)
    .where(and(eq(registryChecks.id, checkId), target.clientId ? eq(registryChecks.clientId, target.clientId) : eq(registryChecks.matterId, target.matterId!), eq(registryChecks.createdById, user.id)));
  revalidatePath(target.clientId ? `/clientes/${target.clientId}` : `/expedientes/${target.matterId}`);
}
