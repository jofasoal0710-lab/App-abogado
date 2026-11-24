import { describe, expect, it } from "vitest";
import { dueState, sortTasks, statusPatch, stepStatus } from "../src/lib/tasks";

describe("tablero de tareas", () => {
  it("avanza y retrocede entre columnas", () => {
    expect(stepStatus("pendiente", 1)).toBe("en_curso");
    expect(stepStatus("en_curso", 1)).toBe("hecha");
    expect(stepStatus("hecha", 1)).toBeNull();
    expect(stepStatus("pendiente", -1)).toBeNull();
    expect(stepStatus("hecha", -1)).toBe("en_curso");
  });
  it("«hecha» marca completada con fecha; volver atrás la reabre", () => {
    const now = new Date("2026-11-24T10:00:00Z");
    expect(statusPatch("hecha", now)).toEqual({ status: "hecha", completed: true, completedAt: now });
    expect(statusPatch("en_curso", now)).toEqual({ status: "en_curso", completed: false, completedAt: null });
  });
  it("ordena por prioridad y luego por fecha", () => {
    const d = (s: string) => new Date(s);
    const rows = [
      { id: 1, priority: "normal" as const, startsAt: d("2026-11-25") },
      { id: 2, priority: "urgente" as const, startsAt: d("2026-12-01") },
      { id: 3, priority: "normal" as const, startsAt: d("2026-11-24") },
      { id: 4, priority: "baja" as const, startsAt: d("2026-11-20") },
    ];
    expect(sortTasks(rows).map((r) => r.id)).toEqual([2, 3, 1, 4]);
  });
  it("estado de la fecha límite", () => {
    expect(dueState("2026-11-20", "2026-11-24", false)).toBe("vencida");
    expect(dueState("2026-11-24", "2026-11-24", false)).toBe("hoy");
    expect(dueState("2026-11-27", "2026-11-24", false)).toBe("pronto");
    expect(dueState("2026-12-10", "2026-11-24", false)).toBe("normal");
    expect(dueState("2026-11-20", "2026-11-24", true)).toBe("normal");
  });
});
