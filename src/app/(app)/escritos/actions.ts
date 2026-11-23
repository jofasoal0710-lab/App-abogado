"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { deedParties, deeds, notaryProfiles, writings } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { cleanValues, missingRequired } from "@/lib/forms/engine";
import { getTemplate } from "@/lib/forms/templates";
import { getAccessibleWriting } from "@/lib/writings";
import { getNotaryProfile } from "@/lib/notary";
import { can } from "@/lib/permissions";
import type { Values } from "@/lib/forms/engine";
import { stampSessionActor, asSessionActor, asActor } from "@/lib/data-audit";

/** Datos de protocolo de una escritura generada con formulario (número, tomo, folio, fecha, hora). */
function deedData(v: Values) {
  const number = Number((v.numero ?? "").replace(/\D/g, ""));
  const folio = Number((v.folio ?? "").replace(/\D/g, ""));
  return {
    number: Number.isInteger(number) && number > 0 ? number : null,
    volume: v.tomo?.trim() || null,
    folioStart: Number.isInteger(folio) && folio > 0 ? folio : null,
    grantedOn: /^\d{4}-\d{2}-\d{2}$/.test(v.fecha ?? "") ? v.fecha : todayISO(),
    grantedAt: v.hora?.trim() || null,
  };
}

function readValues(formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("f_")) raw[k.slice(2)] = v;
  return raw;
}

/** Genera un escrito (o escritura) y lo enlaza al expediente. */
export async function createWritingAction(templateKey: string, matterId: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const tpl = getTemplate(templateKey);
  if (!tpl) return { error: "Ese formulario no existe." };
  if (tpl.kind === "escrito" && matterId === null) return { error: "Elige el expediente al que pertenece el escrito." };
  if (matterId !== null && !(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };

  const values = cleanValues(tpl, readValues(formData));
  const missing = missingRequired(tpl, values);
  if (missing.length) return { error: `Falta: ${missing.join(", ")}.` };

  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || tpl.title;

  // Una escritura de un notario con perfil se anota en su protocolo con el número indicado (que no puede repetirse).
  const notary = tpl.kind === "escritura" && can(user, "notaria.usar") ? await getNotaryProfile(user.id) : null;
  const dd = deedData(values);
  if (notary) {
    if (!dd.number) return { error: "Indica el número de escritura." };
    const [dup] = await db.select({ id: deeds.id }).from(deeds).where(and(eq(deeds.notaryId, user.id), eq(deeds.number, dd.number)));
    if (dup) return { error: `La escritura número ${dd.number} ya está en tu protocolo. Usa el siguiente número libre.` };
  }

  const row = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    const [w] = await tx.insert(writings).values({ matterId, templateKey: tpl.key, kind: tpl.kind, title, values, createdById: user.id }).returning({ id: writings.id });
    if (notary && dd.number) {
      const [d] = await tx
        .insert(deeds)
        .values({ notaryId: user.id, number: dd.number, volume: dd.volume, folioStart: dd.folioStart, grantedOn: dd.grantedOn, grantedAt: dd.grantedAt, act: tpl.title, writingId: w.id })
        .returning({ id: deeds.id });
      const parties = [
        { name: values.cliente, idNumber: values.cedula, role: tpl.key === "compraventa-vehiculo" ? "Vendedor(a)" : tpl.key.startsWith("poder") ? "Poderdante" : "Otorgante" },
        ...(values.comprador?.trim() ? [{ name: values.comprador.split(/[,\n]/)[0], idNumber: "", role: "Comprador(a)" }] : []),
        ...(values.apoderado?.trim() ? [{ name: values.apoderado.split(/[,\n]/)[0], idNumber: "", role: "Apoderado(a)" }] : []),
      ].filter((p) => p.name?.trim());
      if (parties.length) await tx.insert(deedParties).values(parties.map((p) => ({ deedId: d.id, name: p.name.trim().slice(0, 200), idNumber: p.idNumber?.trim() || null, role: p.role })));
      if (dd.folioStart) await tx.update(notaryProfiles).set({ nextFolio: dd.folioStart + 1, currentVolume: dd.volume ?? undefined }).where(eq(notaryProfiles.userId, user.id));
    }
    return w;
  });
  if (matterId !== null) revalidatePath(`/expedientes/${matterId}`);
  redirect(`/escritos/${row.id}?creado=1`);
}

/** Corrige los campos de un escrito ya generado (se vuelve a redactar con los valores nuevos). */
export async function updateWritingAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const w = await getAccessibleWriting(user, id);
  if (!w) return { error: "Ese escrito no existe o no tienes acceso." };
  const tpl = getTemplate(w.templateKey);
  if (!tpl) return { error: "El formulario de este escrito ya no existe." };
  const values = cleanValues(tpl, readValues(formData));
  const missing = missingRequired(tpl, values);
  if (missing.length) return { error: `Falta: ${missing.join(", ")}.` };
  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || tpl.title;
  const dd = deedData(values);
  const [deed] = await db.select({ id: deeds.id, notaryId: deeds.notaryId }).from(deeds).where(eq(deeds.writingId, id));
  if (deed && dd.number) {
    const [dup] = await db.select({ id: deeds.id }).from(deeds).where(and(eq(deeds.notaryId, deed.notaryId), eq(deeds.number, dd.number)));
    if (dup && dup.id !== deed.id) return { error: `El número ${dd.number} ya lo usa otra escritura del protocolo.` };
  }
  await asSessionActor((tx) => tx.update(writings).set({ values, title, updatedAt: new Date() }).where(eq(writings.id, id)));
  if (deed && dd.number) await asSessionActor((tx) => tx.update(deeds).set({ number: dd.number!, volume: dd.volume, folioStart: dd.folioStart, grantedOn: dd.grantedOn, grantedAt: dd.grantedAt }).where(eq(deeds.id, deed.id)));
  if (w.matterId !== null) revalidatePath(`/expedientes/${w.matterId}`);
  redirect(`/escritos/${id}?guardado=1`);
}

export async function deleteWritingAction(id: number) {
  const user = await requireUser();
  const w = await getAccessibleWriting(user, id);
  if (!w) redirect("/formularios");
  // Lo borra quien lo redactó o quien puede borrar documentos.
  const { can } = await import("@/lib/permissions");
  if (w.createdById !== user.id && !can(user, "documentos.borrar")) redirect(`/escritos/${id}?error=forbidden`);
  await asActor(user.id, (tx) => tx.delete(writings).where(and(eq(writings.id, id))));
  redirect(w.matterId !== null ? `/expedientes/${w.matterId}?tab=escritos` : "/formularios");
}
