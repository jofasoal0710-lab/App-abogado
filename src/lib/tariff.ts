import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feeServices, feeSettings, matterFeeStages, type FeeService } from "@/db/schema";
import { splitStages, type ArancelStage } from "./arancel";
import type { ServiceLike } from "./fees";

export type GuideService = ServiceLike & { id: number; area: string; description: string | null };
export type GuideData = { services: GuideService[]; adjustBp: number; adjustNote: string | null };

export async function getFeeSettings() {
  const [row] = await db.select().from(feeSettings).where(eq(feeSettings.id, 1)).limit(1);
  return { arancelAdjustBp: row?.arancelAdjustBp ?? 0, arancelAdjustNote: row?.arancelAdjustNote ?? null };
}

export const toGuideService = (s: FeeService): GuideService => ({
  id: s.id,
  name: s.name,
  area: s.area,
  description: s.description,
  mode: s.mode,
  amountCents: s.amountCents,
  hourlyRateCents: s.hourlyRateCents,
  percentBp: s.percentBp,
  minimumCents: s.minimumCents,
  markupBp: s.markupBp,
  arancelKey: s.arancelKey,
  stages: s.stages ?? [],
});

export async function listServices({ activeOnly = true } = {}) {
  const rows = await db.select().from(feeServices).orderBy(asc(feeServices.area), asc(feeServices.name));
  return activeOnly ? rows.filter((r) => r.active) : rows;
}

/** Datos de la ventana de ayuda «Guía de tarifas»: el tarifario activo y el ajuste del arancel. */
export async function guideData(): Promise<GuideData> {
  const [services, settings] = await Promise.all([listServices(), getFeeSettings()]);
  return { services: services.map(toGuideService), adjustBp: settings.arancelAdjustBp, adjustNote: settings.arancelAdjustNote };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Crea las etapas de cobro de un expediente repartiendo el total (sustituye las pendientes). */
export async function replaceMatterStages(tx: Tx, matterId: number, totalCents: number, stages: ArancelStage[]) {
  await tx.delete(matterFeeStages).where(eq(matterFeeStages.matterId, matterId));
  const parts = splitStages(totalCents, stages);
  if (parts.length) await tx.insert(matterFeeStages).values(parts.map((p, i) => ({ matterId, position: i, name: p.name, amountCents: p.amountCents })));
}
