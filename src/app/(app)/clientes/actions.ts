"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { clients, invoices, matters } from "@/db/schema";
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
  await requireUser();
  const parsed = parseClient(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const [row] = await db.insert(clients).values(parsed.data).returning({ id: clients.id });
  revalidatePath("/clientes");
  redirect(`/clientes/${row.id}`);
}

export async function updateClientAction(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseClient(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  await db.update(clients).set(parsed.data).where(eq(clients.id, id));
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function deleteClientAction(id: number) {
  const user = await requireUser();
  if (user.role === "asistente") redirect(`/clientes/${id}?error=forbidden`);

  const [{ m }] = await db.select({ m: count() }).from(matters).where(eq(matters.clientId, id));
  const [{ i }] = await db.select({ i: count() }).from(invoices).where(eq(invoices.clientId, id));
  if (m > 0 || i > 0) redirect(`/clientes/${id}?error=in_use`);

  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/clientes");
  redirect("/clientes");
}
