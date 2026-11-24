/** Tablero de tareas: lógica pura (estados, prioridades, orden y vencimiento). */
export const TASK_STATUSES = { pendiente: "Pendiente", en_curso: "En curso", hecha: "Hecha" } as const;
export type TaskStatus = keyof typeof TASK_STATUSES;
export const STATUS_ORDER: TaskStatus[] = ["pendiente", "en_curso", "hecha"];

export const TASK_PRIORITIES = { urgente: "Urgente", alta: "Alta", normal: "Normal", baja: "Baja" } as const;
export type TaskPriority = keyof typeof TASK_PRIORITIES;
const PRIORITY_RANK: Record<TaskPriority, number> = { urgente: 0, alta: 1, normal: 2, baja: 3 };

export const isTaskStatus = (v: string): v is TaskStatus => v in TASK_STATUSES;
export const isTaskPriority = (v: string): v is TaskPriority => v in TASK_PRIORITIES;

/** Estado siguiente / anterior en el tablero (null en los extremos). */
export function stepStatus(s: TaskStatus, dir: 1 | -1): TaskStatus | null {
  return STATUS_ORDER[STATUS_ORDER.indexOf(s) + dir] ?? null;
}

/** Al cambiar de estado: `completed` y la fecha de cierre van a la par que «hecha». */
export function statusPatch(s: TaskStatus, now: Date) {
  return s === "hecha" ? { status: s, completed: true, completedAt: now } : { status: s, completed: false, completedAt: null };
}

/** Orden dentro de una columna: prioridad (urgente primero) y luego la fecha más próxima. */
export function sortTasks<T extends { priority: TaskPriority; startsAt: Date; id: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.startsAt.getTime() - b.startsAt.getTime() || a.id - b.id);
}

export type DueState = "vencida" | "hoy" | "pronto" | "normal";
/** Situación de la fecha límite respecto de hoy (fechas «YYYY-MM-DD» en la zona del despacho). */
export function dueState(due: string, today: string, done: boolean): DueState {
  if (done) return "normal";
  if (due < today) return "vencida";
  if (due === today) return "hoy";
  const d = (Date.parse(due) - Date.parse(today)) / 86_400_000;
  return d <= 3 ? "pronto" : "normal";
}
