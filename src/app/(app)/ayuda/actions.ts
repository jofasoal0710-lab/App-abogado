"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getTour } from "@/lib/help/guides";

/** Anota que la persona vio (o saltó) un recorrido, para no volver a mostrárselo solo. */
export async function markTourSeenAction(key: string): Promise<void> {
  const user = await requireUser();
  if (!getTour(key)) return;
  await db
    .update(users)
    .set({ toursSeen: sql`(select array(select distinct unnest(${users.toursSeen} || array[${key}]::text[])))` })
    .where(eq(users.id, user.id));
}

/** Vuelve a mostrar el recorrido de bienvenida la próxima vez que entre en el panel. */
export async function resetToursAction(): Promise<void> {
  const user = await requireUser();
  await db.update(users).set({ toursSeen: [] }).where(eq(users.id, user.id));
}
