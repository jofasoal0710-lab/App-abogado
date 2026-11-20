import Link from "next/link";
import { ConfirmButton } from "@/components/form";
import { Badge, EmptyState } from "@/components/ui";
import type { eventKindEnum } from "@/db/schema";
import { dayKey, daysUntil, formatDate, formatTime, todayISO } from "@/lib/dates";
import { countdown, URGENCY, urgencyOf } from "@/lib/deadlines";
import { eventKindLabels } from "@/lib/labels";
import { deleteEventAction, toggleEventAction } from "./actions";

export type EventRow = {
  id: number;
  title: string;
  kind: (typeof eventKindEnum.enumValues)[number];
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  completed: boolean;
  matterId: number | null;
  matterNumber: string | null;
  assignedName: string | null;
};

export function EventsList({
  rows,
  returnTo,
  showMatter = true,
  empty = "Sin eventos",
}: {
  rows: EventRow[];
  returnTo: string;
  showMatter?: boolean;
  empty?: string;
}) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  const today = todayISO();
  return (
    <ul className="divide-y divide-ink-100">
      {rows.map((e) => {
        const days = daysUntil(e.startsAt);
        const urgency = urgencyOf(days, e.completed);
        const u = URGENCY[urgency];
        return (
          <li key={e.id} className="relative flex flex-wrap items-start gap-3 py-3 pl-6 pr-5">
            <span className={`absolute inset-y-2 left-2 w-1 rounded-full ${u.bar}`} aria-hidden="true" />
            <form action={toggleEventAction.bind(null, e.id)}>
              <button
                aria-label={e.completed ? "Marcar como pendiente" : "Marcar como completado"}
                title={e.completed ? "Marcar como pendiente" : "Marcar como completado"}
                className={`relative mt-0.5 flex h-5 w-5 items-center before:absolute before:-inset-3 before:content-[''] justify-center rounded border text-xs ${
                  e.completed ? "border-emerald-600 bg-emerald-600 text-white" : "border-ink-300 bg-surface text-transparent hover:border-brand-500"
                }`}
              >
                ✓
              </button>
            </form>
            <div className="min-w-0 flex-1">
              <p className={e.completed ? "text-ink-500 line-through" : "font-medium text-ink-900"}>{e.title}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {formatDate(e.startsAt)} · {formatTime(e.startsAt)}
                {e.endsAt && `–${formatTime(e.endsAt)}`}
                {!e.completed && (
                  <span className={`ml-1 ${urgency === "vencido" || urgency === "hoy" ? "font-semibold text-red-700" : urgency === "pronto" ? "font-medium text-amber-800" : ""}`}>
                    · {countdown(dayKey(e.startsAt), today, days, e.completed)}
                  </span>
                )}
                {e.location && ` · ${e.location}`}
                {e.assignedName && ` · ${e.assignedName}`}
                {showMatter && e.matterId && e.matterNumber && (
                  <>
                    {" · "}
                    <Link className="link" href={`/expedientes/${e.matterId}`}>
                      {e.matterNumber}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Badge kind="event" value={e.kind} label={eventKindLabels[e.kind]} />
              <Link className="btn-ghost btn-sm" href={`/agenda/${e.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}>
                Editar
              </Link>
              <form action={deleteEventAction.bind(null, e.id)}>
                <ConfirmButton message="¿Eliminar este evento?" className="btn-ghost btn-sm text-red-700">
                  Borrar
                </ConfirmButton>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
