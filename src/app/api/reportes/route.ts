import { getCurrentUser } from "@/lib/auth";
import { csvDecimal, csvText, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { AGING_BUCKETS, AGING_LABELS, pct, resolvePeriod } from "@/lib/report-calc";
import { aging, billing, hoursByPerson, mattersByArea, profitabilityByArea } from "@/lib/reports";

export const dynamic = "force-dynamic";

const hours = (min: number) => (Math.round(min / 6) / 10).toFixed(1).replace(".", ",");

/** Reportes en CSV (Excel en español). Sin «Ver reportes», solo las propias horas. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo") ?? "";
  const today = todayISO();
  const p = resolvePeriod({ from: url.searchParams.get("desde") ?? undefined, to: url.searchParams.get("hasta") ?? undefined }, today);
  const full = can(user, "reportes.ver");
  if (tipo !== "horas" && !full) return new Response("Prohibido", { status: 403 });

  let csv: string;
  if (tipo === "horas") {
    const rows = await hoursByPerson(user, p, full ? undefined : user.id);
    csv = toCsv(["Persona", "Horas", "Horas facturables", "Horas facturadas", "% facturable", "Valor facturable"], rows.map((r) => [csvText(r.name), hours(r.minutes), hours(r.billableMinutes), hours(r.invoicedMinutes), String(pct(r.billableMinutes, r.minutes)), csvDecimal(r.valueCents)]));
  } else if (tipo === "clientes") {
    const b = await billing(user, p, today);
    csv = toCsv(["Cliente", "Facturas", "Facturado", "Cobrado", "Pendiente"], b.byClient.map((c) => [csvText(c.key), String(c.count), csvDecimal(c.invoiced), csvDecimal(c.paid), csvDecimal(c.outstanding)]));
  } else if (tipo === "cartera") {
    const a = await aging(user, today);
    csv = toCsv(["Cliente", ...AGING_BUCKETS.map((x) => AGING_LABELS[x]), "Total", "Días del más antiguo"], a.rows.map((r) => [csvText(r.client), ...AGING_BUCKETS.map((x) => csvDecimal(r[x])), csvDecimal(r.total), String(r.oldestDays)]));
  } else if (tipo === "materias") {
    const rows = await profitabilityByArea(user, p, today);
    csv = toCsv(["Materia", "Horas", "Valor de horas", "Facturado", "Gastos", "Realización %"], rows.map((r) => [csvText(r.area), hours(r.minutes), csvDecimal(r.hoursValueCents), csvDecimal(r.invoicedCents), csvDecimal(r.expensesCents), r.hoursValueCents ? String(pct(r.invoicedCents, r.hoursValueCents)) : ""]));
  } else if (tipo === "expedientes") {
    const rows = await mattersByArea(user, p);
    csv = toCsv(["Materia", "Activos", "Abiertos en el periodo", "Cerrados en el periodo"], rows.map((r) => [csvText(r.key), String(r.active), String(r.opened), String(r.closed)]));
  } else {
    return new Response("Reporte desconocido", { status: 400 });
  }
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reporte-${tipo}-${p.from}-a-${p.to}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
