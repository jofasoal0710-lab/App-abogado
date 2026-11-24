import type { Metadata } from "next";
import Link from "next/link";
import { and, count, eq, gte, inArray, lt } from "drizzle-orm";
import { Icon, type IconName } from "@/components/icons";
import { IndexAlert } from "@/components/index-alert";
import { db } from "@/db";
import { events, users } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { WIDGET_BY_ID, availableWidgets, effectiveLayout } from "@/lib/dashboard-widgets";
import { currentMonth, todayISO } from "@/lib/dates";
import { appLocale } from "@/lib/locale";
import { pendingIndexes } from "@/lib/notary";
import { can } from "@/lib/permissions";
import { DashboardGrid } from "./panel/dashboard-grid";
import { renderWidget } from "./panel/widgets";

export const metadata: Metadata = { title: "Panel" };

/**
 * Panel de inicio: saludo con el resumen del día y, debajo, los widgets que cada persona elige, ordena y
 * dimensiona («Personalizar panel»). Solo se consultan los datos de los widgets que tiene puestos.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; mes?: string }> }) {
  const user = await requireUser();
  const { error, mes } = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes ?? "") ? mes! : currentMonth();
  const allowed = (p: Parameters<typeof can>[1]) => can(user, p);

  const sod = new Date(new Date().setHours(0, 0, 0, 0));
  const mine = and(eq(events.assignedId, user.id), eq(events.completed, false), matterAccessSql(user, events.matterId, { orNone: true }));
  const [[saved], [today], [week], [overdue], indexPending] = await Promise.all([
    db.select({ layout: users.dashboardLayout }).from(users).where(eq(users.id, user.id)),
    db.select({ n: count() }).from(events).where(and(mine, gte(events.startsAt, sod), lt(events.startsAt, new Date(sod.getTime() + 86_400_000)))),
    db.select({ n: count() }).from(events).where(and(mine, gte(events.startsAt, sod), lt(events.startsAt, new Date(sod.getTime() + 7 * 86_400_000)))),
    db.select({ n: count() }).from(events).where(and(mine, lt(events.startsAt, sod), inArray(events.kind, ["plazo", "tarea"]))),
    can(user, "notaria.usar") ? pendingIndexes(user.id, todayISO()) : Promise.resolve([]),
  ]);
  const layout = effectiveLayout(saved?.layout ?? null, allowed);
  const widgets = layout.map((l) => {
    const def = WIDGET_BY_ID.get(l.id)!;
    return { id: l.id, size: l.size, title: def.title, sizes: def.sizes, node: renderWidget(l.id, user, month) };
  });
  const catalog = availableWidgets(layout, allowed).map((w) => ({ id: w.id, title: w.title, description: w.description, icon: w.icon as IconName, defaultSize: w.defaultSize }));
  // El catálogo incluye también los que ya están puestos (por si se quitan en esta misma sesión de edición).
  const fullCatalog = [...catalog, ...layout.map((l) => WIDGET_BY_ID.get(l.id)!).map((w) => ({ id: w.id, title: w.title, description: w.description, icon: w.icon as IconName, defaultSize: w.defaultSize }))];

  const summary =
    today.n > 0
      ? `Hoy tienes ${today.n} ${today.n === 1 ? "cosa en agenda" : "cosas en agenda"}.`
      : week.n > 0
        ? `Nada para hoy. ${week.n} ${week.n === 1 ? "plazo o evento" : "plazos o eventos"} en los próximos 7 días.`
        : "Sin plazos ni eventos en los próximos 7 días.";

  return (
    <>
      <section className="relative mb-5 overflow-hidden rounded-2xl bg-brand-800 px-6 py-6 text-white sm:px-8">
        <Icon name="balanza" className="pointer-events-none absolute -right-6 -top-8 h-48 w-48 text-white/[0.06]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-white/70 first-letter:uppercase">{new Date().toLocaleDateString(appLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold">Hola, {user.name.split(" ")[0]}</h1>
            <p className="mt-1.5 max-w-xl text-white/80">
              {summary}
              {overdue.n > 0 && (
                <>
                  {" "}
                  <Link href="/agenda?mios=1" className="font-semibold text-amber-200 underline-offset-2 hover:underline">
                    {overdue.n} {overdue.n === 1 ? "plazo vencido" : "plazos vencidos"} sin completar.
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Link href="/tareas" className="btn border border-white/30 text-white hover:bg-white/10">
              Mis tareas
            </Link>
            <Link href="/agenda/nuevo" className="btn border border-white/30 text-white hover:bg-white/10">
              Nuevo plazo
            </Link>
            <Link href="/expedientes/nuevo" className="btn bg-white text-brand-800 hover:bg-white/90">
              Nuevo expediente
            </Link>
          </div>
        </div>
      </section>

      {indexPending.length > 0 && <IndexAlert pending={indexPending} />}
      {error === "forbidden" && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No tienes permiso para acceder a esa sección.
        </p>
      )}

      <DashboardGrid widgets={widgets} catalog={fullCatalog} />
    </>
  );
}
