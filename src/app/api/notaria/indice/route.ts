import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { deedParties, deeds } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { csvText as csvCell } from "@/lib/csv";
import { formatDate, todayISO } from "@/lib/dates";
import { quincena, quincenaOf } from "@/lib/notary-period";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Índice quincenal en CSV (Excel en español: «;» y BOM). Solo el protocolo propio. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!can(user, "notaria.usar")) return new Response("Sin permiso", { status: 403 });
  const q = quincena(new URL(req.url).searchParams.get("q") ?? "") ?? quincenaOf(todayISO());
  const rows = await db.select().from(deeds).where(and(eq(deeds.notaryId, user.id), gte(deeds.grantedOn, q.start), lte(deeds.grantedOn, q.end))).orderBy(asc(deeds.number));
  const parties = rows.length ? await db.select().from(deedParties).where(inArray(deedParties.deedId, rows.map((r) => r.id))) : [];
  const head = ["Número", "Fecha", "Hora", "Acto o contrato", "Comparecientes", "Tomo", "Folio inicial", "Folio final", "Estado"];
  const lines = rows.map((d) =>
    [String(d.number), formatDate(d.grantedOn), d.grantedAt ?? "", d.act, parties.filter((p) => p.deedId === d.id).map((p) => `${p.name}${p.idNumber ? ` (${p.idNumber})` : ""}`).join(" / "), d.volume ?? "", d.folioStart?.toString() ?? "", d.folioEnd?.toString() ?? "", d.status === "no_paso" ? "No pasó" : "Otorgada"]
      .map(csvCell)
      .join(";"),
  );
  const body = "﻿" + [head.map(csvCell).join(";"), ...lines].join("\r\n");
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="indice-notarial-${q.key}.csv"`, "cache-control": "no-store" } });
}
