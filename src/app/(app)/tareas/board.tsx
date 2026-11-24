"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { STATUS_ORDER, TASK_PRIORITIES, TASK_STATUSES, stepStatus, type DueState, type TaskPriority, type TaskStatus } from "@/lib/tasks";
import { moveTaskAction } from "./actions";

export type BoardTask = {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueLabel: string;
  dueState: DueState;
  matterId: number | null;
  matterNumber: string | null;
  assignee: string | null;
  initials: string;
  editHref: string;
};

const PRIORITY_STYLE: Record<TaskPriority, string> = { urgente: "badge-red", alta: "badge-amber", normal: "badge-gray", baja: "badge-gray opacity-70" };
const DUE_STYLE: Record<DueState, string> = { vencida: "font-semibold text-red-700", hoy: "font-semibold text-amber-700", pronto: "text-amber-700", normal: "text-ink-500" };
const COLUMN_STYLE: Record<TaskStatus, string> = { pendiente: "border-t-ink-300", en_curso: "border-t-brand-500", hecha: "border-t-emerald-500" };

/**
 * Tablero de tareas: arrastrar una tarjeta a otra columna (o usar los botones ‹ ›, que también funcionan
 * con teclado y en el móvil) cambia su estado. El cambio se ve al instante y se guarda en el servidor.
 */
export function TaskBoard({ tasks }: { tasks: BoardTask[] }) {
  const [, start] = useTransition();
  const [view, setOptimistic] = useOptimistic(tasks, (cur, m: { id: number; status: TaskStatus }) => cur.map((t) => (t.id === m.id ? { ...t, status: m.status } : t)));
  const move = (id: number, status: TaskStatus) =>
    start(async () => {
      setOptimistic({ id, status });
      await moveTaskAction(id, status);
    });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {STATUS_ORDER.map((col) => {
        const items = view.filter((t) => t.status === col);
        return (
          <section
            key={col}
            aria-label={TASK_STATUSES[col]}
            className={`flex min-h-40 flex-col rounded-xl border border-t-4 border-ink-200 bg-ink-50/60 ${COLUMN_STYLE[col]}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = Number(e.dataTransfer.getData("text/task"));
              if (id) move(id, col);
            }}
          >
            <h2 className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-ink-700">
              {TASK_STATUSES[col]}
              <span className="rounded-full bg-white px-2 text-xs tabular-nums text-ink-500 ring-1 ring-ink-200">{items.length}</span>
            </h2>
            <ul className="flex flex-1 flex-col gap-2 px-2 pb-2" data-column={col}>
              {items.length === 0 && <li className="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-400">{col === "hecha" ? "Nada terminado en las últimas dos semanas" : "Sin tareas"}</li>}
              {items.map((t) => {
                const prev = stepStatus(t.status, -1);
                const next = stepStatus(t.status, 1);
                return (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task", String(t.id))}
                    className={`group cursor-grab rounded-lg border border-ink-200 bg-white p-3 shadow-sm active:cursor-grabbing ${t.status === "hecha" ? "opacity-70" : ""}`}
                    data-task={t.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={t.editHref} className={`text-sm font-medium text-ink-900 hover:text-brand-700 ${t.status === "hecha" ? "line-through" : ""}`}>
                        {t.title}
                      </Link>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-800" title={t.assignee ?? "Sin asignar"}>
                        {t.initials}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className={PRIORITY_STYLE[t.priority]}>{TASK_PRIORITIES[t.priority]}</span>
                      <span className={DUE_STYLE[t.dueState]}>{t.dueLabel}</span>
                      {t.matterId && (
                        <Link href={`/expedientes/${t.matterId}?tab=agenda`} className="link">
                          {t.matterNumber}
                        </Link>
                      )}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <button type="button" className="btn-ghost btn-sm px-2 disabled:invisible" disabled={!prev} onClick={() => prev && move(t.id, prev)} aria-label={prev ? `Mover «${t.title}» a ${TASK_STATUSES[prev]}` : undefined}>
                        ‹ {prev ? TASK_STATUSES[prev] : ""}
                      </button>
                      <button type="button" className="btn-ghost btn-sm px-2 disabled:invisible" disabled={!next} onClick={() => next && move(t.id, next)} aria-label={next ? `Mover «${t.title}» a ${TASK_STATUSES[next]}` : undefined}>
                        {next ? TASK_STATUSES[next] : ""} ›
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
