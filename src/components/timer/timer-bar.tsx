import Link from "next/link";
import { eq } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { db } from "@/db";
import { matters, runningTimers } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { FORGOTTEN_AFTER_SECONDS, elapsedSeconds } from "@/lib/timer";
import { discardTimerAction, startTimerAction, stopTimerAction, toggleTimerAction } from "@/app/(app)/horas/timer-actions";
import { TimerClock } from "./timer-clock";

/** Barra del cronómetro en marcha: visible en todas las pantallas mientras haya uno (en marcha o en pausa). */
export async function TimerBar({ user }: { user: CurrentUser }) {
  const [t] = await db
    .select({ matterId: runningTimers.matterId, description: runningTimers.description, startedAt: runningTimers.startedAt, accumulatedSeconds: runningTimers.accumulatedSeconds, number: matters.number, title: matters.title })
    .from(runningTimers)
    .innerJoin(matters, eq(matters.id, runningTimers.matterId))
    .where(eq(runningTimers.userId, user.id));
  if (!t) return null;
  const running = !!t.startedAt;
  const forgotten = elapsedSeconds(t, new Date()) > FORGOTTEN_AFTER_SECONDS;
  return (
    <div className="no-print sticky top-0 z-30 border-b border-brand-100 bg-brand-50/95 px-4 py-2 backdrop-blur sm:px-8" role="region" aria-label="Cronómetro de horas">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${running ? "animate-pulse bg-red-500" : "bg-ink-400"}`} aria-hidden />
        <TimerClock startedAt={t.startedAt?.toISOString() ?? null} accumulatedSeconds={t.accumulatedSeconds} />
        <span className="min-w-0 flex-1 truncate">
          {running ? "Midiendo" : "En pausa"} ·{" "}
          <Link className="link" href={`/expedientes/${t.matterId}?tab=horas`}>
            {t.number}
          </Link>{" "}
          <span className="text-ink-600">{t.title}</span>
        </span>
        <form action={toggleTimerAction}>
          <button className="btn-secondary btn-sm">{running ? "Pausar" : "Reanudar"}</button>
        </form>
        <details className="relative">
          <summary className="btn-primary btn-sm cursor-pointer list-none">Detener y registrar</summary>
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-ink-200 bg-white p-4 shadow-lg">
            {forgotten && <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">Lleva más de 12 horas: ¿se quedó encendido? Revisa antes de registrar.</p>}
            <ActionForm action={stopTimerAction} className="space-y-3">
              <label className="block text-sm">
                <span className="label">Trabajo realizado</span>
                <textarea className="input min-h-20" name="description" required minLength={3} maxLength={1000} defaultValue={t.description} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="billable" defaultChecked /> Facturable
              </label>
              <p className="text-xs text-ink-500">Se redondea hacia arriba a tramos de {config.timerRoundMinutes} min.</p>
              <SubmitButton>Registrar horas</SubmitButton>
            </ActionForm>
          </div>
        </details>
        <form action={discardTimerAction}>
          <button className="btn-ghost btn-sm text-red-700" aria-label="Descartar el cronómetro sin registrar">
            Descartar
          </button>
        </form>
      </div>
    </div>
  );
}

/** Botón «Iniciar cronómetro» (con una nota opcional) para la cabecera del expediente. */
export async function StartTimer({ user, matterId }: { user: CurrentUser; matterId: number }) {
  const [t] = await db.select({ matterId: runningTimers.matterId }).from(runningTimers).where(eq(runningTimers.userId, user.id));
  if (t) return null;
  return (
    <details className="relative">
      <summary className="btn-secondary cursor-pointer list-none">Iniciar cronómetro</summary>
      <div className="absolute right-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-ink-200 bg-white p-4 shadow-lg">
        <ActionForm action={startTimerAction.bind(null, matterId)} className="space-y-3">
          <label className="block text-sm">
            <span className="label">¿En qué vas a trabajar? (opcional)</span>
            <input className="input" name="description" maxLength={1000} placeholder="Revisión de la contestación…" />
          </label>
          <SubmitButton pendingText="Iniciando…">Empezar a medir</SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}
