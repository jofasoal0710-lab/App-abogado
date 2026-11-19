"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { deedParties, deeds, notaryProfiles, testimonies } from "@/db/schema";
import { firstZodError, optStr, str, type ActionState } from "@/lib/actions";
import { requirePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getNotaryProfile, getOwnDeed, nextDeedNumber } from "@/lib/notary";

const user = () => requirePermission("notaria.usar");
const isoDate = z.iso.date("La fecha no es válida");

export async function saveNotaryProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const u = await user();
  const parsed = z
    .object({
      fullName: z.string().min(3, "Escribe el nombre completo del notario").max(200),
      idNumber: z.string().max(40).nullable(),
      barNumber: z.string().max(40).nullable(),
      office: z.string().max(300).nullable(),
      phone: z.string().max(40).nullable(),
      email: z.string().max(200).nullable(),
      currentVolume: z.string().max(20).nullable(),
      nextFolio: z.number().int().min(1, "El folio debe ser 1 o más").max(100000),
    })
    .safeParse({
      fullName: str(formData, "fullName"),
      idNumber: optStr(formData, "idNumber"),
      barNumber: optStr(formData, "barNumber"),
      office: optStr(formData, "office"),
      phone: optStr(formData, "phone"),
      email: optStr(formData, "email"),
      currentVolume: optStr(formData, "currentVolume"),
      nextFolio: Number(str(formData, "nextFolio") || 1),
    });
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  await db
    .insert(notaryProfiles)
    .values({ userId: u.id, ...parsed.data })
    .onConflictDoUpdate({ target: notaryProfiles.userId, set: { ...parsed.data, updatedAt: new Date() } });
  revalidatePath("/notaria");
  return { ok: "Perfil de notario guardado." };
}

const deedSchema = z.object({
  number: z.number({ error: "Número de escritura no válido" }).int().min(1, "Número de escritura no válido"),
  volume: z.string().max(20).nullable(),
  folioStart: z.number().int().min(1).nullable(),
  folioEnd: z.number().int().min(1).nullable(),
  grantedOn: isoDate,
  grantedAt: z.string().max(60).nullable(),
  act: z.string().min(3, "Indica el acto o contrato").max(300),
  notes: z.string().max(2000).nullable(),
});

const intOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

function parseDeed(formData: FormData) {
  return deedSchema.safeParse({
    number: Number(str(formData, "number")),
    volume: optStr(formData, "volume"),
    folioStart: intOrNull(str(formData, "folioStart")),
    folioEnd: intOrNull(str(formData, "folioEnd")),
    grantedOn: str(formData, "grantedOn") || todayISO(),
    grantedAt: optStr(formData, "grantedAt"),
    act: str(formData, "act"),
    notes: optStr(formData, "notes"),
  });
}

/** Registra una escritura en el protocolo del notario. El número no puede repetirse. */
export async function createDeedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const u = await user();
  if (!(await getNotaryProfile(u.id))) return { error: "Configura antes tu perfil de notario." };
  const parsed = parseDeed(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const d = parsed.data;
  if (d.folioStart && d.folioEnd && d.folioEnd < d.folioStart) return { error: "El folio final no puede ser menor que el inicial." };
  const [dup] = await db.select({ id: deeds.id }).from(deeds).where(and(eq(deeds.notaryId, u.id), eq(deeds.number, d.number)));
  if (dup) return { error: `Ya existe la escritura número ${d.number} en tu protocolo. El siguiente libre es el ${await nextDeedNumber(u.id)}.` };
  const [row] = await db.insert(deeds).values({ ...d, notaryId: u.id }).returning({ id: deeds.id });
  // El perfil avanza al folio siguiente al último usado.
  if (d.folioEnd) await db.update(notaryProfiles).set({ nextFolio: d.folioEnd + 1, currentVolume: d.volume ?? undefined }).where(eq(notaryProfiles.userId, u.id));
  revalidatePath("/notaria");
  redirect(`/notaria/escrituras/${row.id}`);
}

export async function updateDeedAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const u = await user();
  if (!(await getOwnDeed(u.id, id))) return { error: "Esa escritura no está en tu protocolo." };
  const parsed = parseDeed(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const status = str(formData, "status") === "no_paso" ? "no_paso" : "otorgada";
  const [dup] = await db.select({ id: deeds.id }).from(deeds).where(and(eq(deeds.notaryId, u.id), eq(deeds.number, parsed.data.number)));
  if (dup && dup.id !== id) return { error: `El número ${parsed.data.number} ya lo usa otra escritura de tu protocolo.` };
  await db.update(deeds).set({ ...parsed.data, status }).where(eq(deeds.id, id));
  revalidatePath(`/notaria/escrituras/${id}`);
  return { ok: "Escritura actualizada." };
}

export async function addPartyAction(deedId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const u = await user();
  if (!(await getOwnDeed(u.id, deedId))) return { error: "Esa escritura no está en tu protocolo." };
  const name = str(formData, "name");
  if (name.length < 3) return { error: "Escribe el nombre del compareciente." };
  await db.insert(deedParties).values({ deedId, name: name.slice(0, 200), idNumber: optStr(formData, "idNumber")?.slice(0, 40) ?? null, role: (str(formData, "role") || "Otorgante").slice(0, 60) });
  revalidatePath(`/notaria/escrituras/${deedId}`);
  return { ok: "Compareciente añadido." };
}

/** Marca (o desmarca) que el compareciente firmó, con la fecha de hoy. */
export async function toggleSignatureAction(deedId: number, partyId: number) {
  const u = await user();
  if (!(await getOwnDeed(u.id, deedId))) return;
  const [p] = await db.select().from(deedParties).where(and(eq(deedParties.id, partyId), eq(deedParties.deedId, deedId)));
  if (!p) return;
  await db.update(deedParties).set({ signedOn: p.signedOn ? null : todayISO() }).where(eq(deedParties.id, partyId));
  revalidatePath(`/notaria/escrituras/${deedId}`);
}

export async function deletePartyAction(deedId: number, partyId: number) {
  const u = await user();
  if (!(await getOwnDeed(u.id, deedId))) return;
  await db.delete(deedParties).where(and(eq(deedParties.id, partyId), eq(deedParties.deedId, deedId)));
  revalidatePath(`/notaria/escrituras/${deedId}`);
}

/** Registra la expedición de un testimonio (se numeran solos: primero, segundo…). */
export async function addTestimonyAction(deedId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const u = await user();
  if (!(await getOwnDeed(u.id, deedId))) return { error: "Esa escritura no está en tu protocolo." };
  const date = str(formData, "issuedOn") || todayISO();
  if (!isoDate.safeParse(date).success) return { error: "La fecha no es válida." };
  const existing = await db.select({ id: testimonies.id }).from(testimonies).where(eq(testimonies.deedId, deedId));
  await db.insert(testimonies).values({ deedId, ordinal: existing.length + 1, issuedOn: date, issuedTo: optStr(formData, "issuedTo")?.slice(0, 200) ?? null, notes: optStr(formData, "notes")?.slice(0, 1000) ?? null });
  revalidatePath(`/notaria/escrituras/${deedId}`);
  return { ok: "Testimonio registrado." };
}
