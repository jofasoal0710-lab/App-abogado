import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { events, matters, users } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { dayKey, formatDate, formatTime, todayISO } from "@/lib/dates";
import { HEARING_MODES, overlaps } from "@/lib/hearings";
import { qs } from "@/lib/search";

export const metadata: Metadata = { title: "Audiencias" };

const RANGES = { "30": "Próximos 30 días", "60": "Próximos 60 días", "90": "Próximos 90 días" } as const;

/** Próximas audiencias del despacho (o las mías), agrupadas por día, con choques de horario marcados. */
export default async function HearingsPage({ searchParams }: { searchParams: Promise<{ mios?: string; dias?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const mine = sp.mios === "1";
  const days = sp.dias && sp.dias in RANGES ? Number(sp.dias) : 60;
  const from = new Date(new Date().setHours(0, 0, 0, 0));
  const to = new Date(from.getTime() + days * 86_400_000);
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      hearingType: events.hearingType,
      hearingMode: events.hearingMode,
      meetingUrl: events.meetingUrl,
      assignedId: events.assignedId,
      assignedName: users.name,
      matterId: matters.id,
      matterNumber: matters.number,
      court: matters.court,
      courtCaseNumber: matters.courtCaseNumber,
    })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .leftJoin(users, eq(users.id, events.assignedId))
    .where(and(eq(events.kind, "audiencia"), eq(events.completed, false), gte(events.startsAt, from), lt(events.startsAt, to), mine ? eq(events.assignedId, user.id) : undefined, matterAccessSql(user, events.matterId, { orNone: true })))
    .orderBy(asc(events.startsAt));

  // Choques: misma persona, horarios que se solapan.
  const clash = new Set<number>();
  rows.forEach((a, i) => rows.slice(i + 1).forEach((b) => a.assignedId && a.assignedId === b.assignedId && overlaps(a, b) && (clash.add(a.id), clash.add(b.id))));
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) byDay.set(dayKey(r.startsAt), [...(byDay.get(dayKey(r.startsAt)) ?? []), r]);
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Audiencias"
        subtitle={`${rows.length} ${rows.length === 1 ? "audiencia" : "audiencias"} ${mine ? "asignadas a ti" : "del despacho"} · ${RANGES[String(days) as keyof typeof RANGES].toLowerCase()}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-secondary" href="/agenda">
              Volver a la agenda
            </Link>
            <Link className="btn-primary" href="/agenda/nuevo?tipo=audiencia&returnTo=/agenda/audiencias">
              Nueva audiencia
            </Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {Object.entries(RANGES).map(([k, l]) => (
          <Link key={k} className={String(days) === k ? "btn-primary btn-sm" : "btn-secondary btn-sm"} href={`/agenda/audiencias${qs({ dias: k, mios: mine ? "1" : "" })}`}>
            {l}
          </Link>
        ))}
        <Link className="link ml-2" href={`/agenda/audiencias${qs({ dias: String(days), mios: mine ? "" : "1" })}`}>
          {mine ? "Ver las de todo el equipo" : "Ver solo las mías"}
        </Link>
        <Link className="link ml-auto" href="/cuenta#calendario">
          Verlas en el calendario del teléfono
        </Link>
      </div>
      {clash.size > 0 && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Hay {clash.size} audiencias con choque de horario para la misma persona (marcadas abajo).
        </p>
      )}
      {rows.length === 0 ? (
        <div className="card card-pad text-sm text-ink-500">No hay audiencias en este periodo.</div>
      ) : (
        [...byDay.entries()].map(([day, list]) => (
          <section key={day} className="card mb-4">
            <h2 className="border-b border-ink-100 px-5 py-2 text-sm font-semibold text-ink-700">
              {formatDate(day)} {day === today && <span className="badge-red ml-2">Hoy</span>}
            </h2>
            <ul className="divide-y divide-ink-100">
              {list.map((h) => (
                <li key={h.id} className="flex flex-wrap items-start gap-4 px-5 py-3">
                  <div className="w-24 shrink-0 font-mono text-sm">
                    {formatTime(h.startsAt)}
                    {h.endsAt && <span className="block text-ink-500">{formatTime(h.endsAt)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">
                      {h.hearingType ?? "Audiencia"} · {h.title}
                      {clash.has(h.id) && <span className="badge-red ml-2">Choque de horario</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-600">
                      {[h.court, h.location].filter(Boolean).join(" · ") || "Sin lugar indicado"}
                      {h.hearingMode && ` · ${HEARING_MODES[h.hearingMode as keyof typeof HEARING_MODES] ?? h.hearingMode}`}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {h.matterId && h.matterNumber && (
                        <Link className="link" href={`/expedientes/${h.matterId}`}>
                          {h.matterNumber}
                        </Link>
                      )}
                      {h.courtCaseNumber && ` · Exp. judicial ${h.courtCaseNumber}`}
                      {` · ${h.assignedName ?? "Sin responsable"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {h.meetingUrl && (
                      <a className="btn-primary btn-sm" href={h.meetingUrl} target="_blank" rel="noopener noreferrer">
                        Unirse
                      </a>
                    )}
                    <a className="btn-ghost btn-sm" href={`/api/agenda/${h.id}/ics`} aria-label={`Añadir «${h.title}» a mi calendario`}>
                      .ics
                    </a>
                    <Link className="btn-ghost btn-sm" href={`/agenda/${h.id}/editar?returnTo=${encodeURIComponent("/agenda/audiencias")}`}>
                      Editar
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
