"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions";
import { requirePermission } from "@/lib/auth";
import { createBackup } from "@/lib/backup";

export async function backupNowAction(): Promise<ActionState> {
  await requirePermission("equipo.gestionar");
  try {
    const r = await createBackup();
    revalidatePath("/seguridad/respaldos");
    return { ok: `Copia creada: ${r.rows} filas (${Math.round(r.bytes / 1024)} KB).` };
  } catch (err) {
    return { error: `No se pudo crear la copia: ${(err as Error).message}` };
  }
}
