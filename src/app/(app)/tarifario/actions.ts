"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { feeServices, feeSettings } from "@/db/schema";
import { firstZodError, optStr, str, type ActionState } from "@/lib/actions";
import { ARANCEL_AREAS, arancelItem } from "@/lib/arancel";
import { requirePermission } from "@/lib/auth";
import { parsePercentToBp, parseStages } from "@/lib/fees";
import { parseMoneyToCents } from "@/lib/money";

/** Quien emite facturas define los precios del despacho. */
const MANAGE = "facturacion.emitir" as const;

const serviceSchema = z
  .object({
    name: z.string().min(3, "Escribe el nombre del servicio (mínimo 3 caracteres)").max(200),
    area: z.enum([...(Object.keys(ARANCEL_AREAS) as [string, ...string[]]), "otros"]),
    mode: z.enum(["fijo", "horas", "porcentaje", "arancel"]),
    amountCents: z.number().int().nonnegative().nullable(),
    hourlyRateCents: z.number().int().nonnegative().max(2_000_000_000).nullable(),
    percentBp: z.number().int().min(0).max(10000).nullable(),
    minimumCents: z.number().int().nonnegative().nullable(),
    markupBp: z.number().int().min(0).max(100000),
    arancelKey: z.string().nullable(),
    stages: z.array(z.object({ name: z.string(), percent: z.number() })),
    description: z.string().max(2000).nullable(),
    active: z.boolean(),
  })
  .refine((v) => v.mode !== "fijo" || (v.amountCents ?? 0) > 0, { message: "Indica el precio del servicio", path: ["amountCents"] })
  .refine((v) => v.mode !== "horas" || (v.hourlyRateCents ?? 0) > 0, { message: "Indica la tarifa por hora", path: ["hourlyRateCents"] })
  .refine((v) => v.mode !== "porcentaje" || (v.percentBp ?? 0) > 0, { message: "Indica el porcentaje sobre la cuantía", path: ["percentBp"] })
  .refine((v) => v.mode !== "arancel" || !!v.arancelKey, { message: "Elige la referencia del arancel", path: ["arancelKey"] })
  .refine((v) => !v.arancelKey || !!arancelItem(v.arancelKey), { message: "La referencia del arancel no es válida", path: ["arancelKey"] });

function parseService(formData: FormData) {
  const money = (name: string, label: string): { cents: number | null } | { error: string } => {
    const raw = str(formData, name);
    if (!raw) return { cents: null };
    const cents = parseMoneyToCents(raw);
    return cents === null || cents < 0 ? { error: `${label} no es un importe válido.` } : { cents };
  };
  const amount = money("amount", "El precio");
  const rate = money("hourlyRate", "La tarifa por hora");
  const minimum = money("minimum", "El mínimo");
  for (const m of [amount, rate, minimum]) if ("error" in m) return { error: m.error };
  const pctRaw = str(formData, "percent");
  const percentBp = pctRaw ? parsePercentToBp(pctRaw) : null;
  if (pctRaw && percentBp === null) return { error: "El porcentaje no es válido (p. ej. 2,5)." };
  const markupRaw = str(formData, "markup");
  const markupBp = markupRaw ? parsePercentToBp(markupRaw) : 0;
  if (markupBp === null) return { error: "El recargo no es válido (p. ej. 10)." };
  const stages = parseStages(str(formData, "stages"));
  if ("error" in stages) return { error: stages.error };

  const parsed = serviceSchema.safeParse({
    name: str(formData, "name"),
    area: str(formData, "area") || "abogacia",
    mode: str(formData, "mode"),
    amountCents: (amount as { cents: number | null }).cents,
    hourlyRateCents: (rate as { cents: number | null }).cents,
    percentBp,
    minimumCents: (minimum as { cents: number | null }).cents,
    markupBp,
    arancelKey: optStr(formData, "arancelKey"),
    stages: stages.stages,
    description: optStr(formData, "description"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  return { data: parsed.data };
}

export async function createServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission(MANAGE);
  const r = parseService(formData);
  if ("error" in r) return { error: r.error };
  await db.insert(feeServices).values(r.data!);
  revalidatePath("/tarifario");
  redirect("/tarifario?ok=creado");
}

export async function updateServiceAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission(MANAGE);
  const r = parseService(formData);
  if ("error" in r) return { error: r.error };
  const done = await db.update(feeServices).set({ ...r.data!, updatedAt: new Date() }).where(eq(feeServices.id, id)).returning({ id: feeServices.id });
  if (!done.length) return { error: "El servicio ya no existe." };
  revalidatePath("/tarifario");
  redirect("/tarifario?ok=guardado");
}

/** Borra un servicio (los expedientes que lo usaban conservan su monto pactado). */
export async function deleteServiceAction(id: number) {
  await requirePermission(MANAGE);
  await db.delete(feeServices).where(eq(feeServices.id, id));
  revalidatePath("/tarifario");
  redirect("/tarifario?ok=borrado");
}

/** Añade al tarifario un servicio que sigue el arancel oficial (con sus etapas de pago). */
export async function addFromArancelAction(key: string) {
  await requirePermission(MANAGE);
  const item = arancelItem(key);
  if (!item) redirect("/tarifario");
  await db.insert(feeServices).values({
    name: item.name,
    area: item.area,
    mode: item.rule.kind === "hora" ? "horas" : "arancel",
    hourlyRateCents: item.rule.kind === "hora" ? item.rule.min : null,
    arancelKey: item.key,
    stages: item.stages?.map((s) => ({ name: s.name, percent: s.percent })) ?? [],
    description: item.note ?? null,
  });
  revalidatePath("/tarifario");
  redirect("/tarifario?ok=creado");
}

export async function saveFeeSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission(MANAGE);
  const raw = str(formData, "adjust");
  const bp = raw ? parsePercentToBp(raw) : 0;
  if (bp === null || bp > 5000) return { error: "La actualización debe ser un porcentaje entre 0 y 50 (p. ej. 6,5)." };
  const note = optStr(formData, "note");
  await db
    .insert(feeSettings)
    .values({ id: 1, arancelAdjustBp: bp, arancelAdjustNote: note })
    .onConflictDoUpdate({ target: feeSettings.id, set: { arancelAdjustBp: bp, arancelAdjustNote: note, updatedAt: new Date() } });
  revalidatePath("/tarifario");
  return { ok: "Actualización del arancel guardada." };
}
