import { describe, expect, it } from "vitest";
import { PROCEDURAL_DEADLINES } from "../src/lib/assistant-reason";
import { addBusinessDaysCR, isBusinessDayCR } from "../src/lib/cr-holidays";
import { PROCESS_TEMPLATES, getTemplate, planTemplate, subtractBusinessDaysCR } from "../src/lib/process-templates";

describe("plantillas de proceso", () => {
  it("cada plantilla tiene exactamente un plazo legal, de la tabla verificada", () => {
    for (const t of PROCESS_TEMPLATES) {
      const plazos = t.steps.filter((s) => s.type === "plazo");
      expect(plazos.length, t.key).toBe(1);
      expect(PROCEDURAL_DEADLINES.some((d) => d.key === (plazos[0] as { deadline: string }).deadline), t.key).toBe(true);
    }
    expect(new Set(PROCESS_TEMPLATES.map((t) => t.key)).size).toBe(PROCESS_TEMPLATES.length);
  });
  it("retroceder días hábiles es el inverso de avanzarlos", () => {
    const d = addBusinessDaysCR("2026-03-02", 10);
    expect(subtractBusinessDaysCR(d, 10) <= "2026-03-02").toBe(true);
    expect(subtractBusinessDaysCR("2026-11-23", 0)).toBe("2026-11-23");
    expect(isBusinessDayCR(subtractBusinessDaysCR("2026-11-23", 3))).toBe(true);
  });
  it("contestar ordinario: 30 días hábiles (CPC 102.1) y las tareas antes del vencimiento", () => {
    const plan = planTemplate(getTemplate("contestar_ordinario")!, "2026-02-02", "2026-02-02");
    const plazo = plan.find((p) => p.type === "plazo")!;
    expect(plazo.date).toBe(addBusinessDaysCR("2026-02-02", 30));
    expect(plazo.ref).toBe("CPC art. 102.1");
    for (const p of plan.filter((x) => x.type === "tarea")) {
      expect(p.date < plazo.date).toBe(true);
      expect(p.date >= "2026-02-02").toBe(true);
      expect(isBusinessDayCR(p.date)).toBe(true);
    }
    expect(plan.map((p) => p.date)).toEqual([...plan.map((p) => p.date)].sort());
  });
  it("las tareas que caerían en el pasado se proponen para hoy", () => {
    const plan = planTemplate(getTemplate("casacion_civil")!, "2026-01-05", "2026-01-20");
    expect(plan.filter((p) => p.type === "tarea").every((p) => p.date >= "2026-01-20")).toBe(true);
    const old = planTemplate(getTemplate("contestar_sumario")!, "2025-01-06", "2026-01-20");
    expect(old.find((p) => p.type === "plazo")!.past).toBe(true);
  });
  it("Semana Santa no cuenta (feriados de Costa Rica)", () => {
    // Jueves y Viernes Santo 2026: 2 y 3 de abril. Notificado el 1 de abril, el plazo de 3 días hábiles salta esos días.
    const plan = planTemplate(getTemplate("apelar_sentencia_civil")!, "2026-04-01", "2026-04-01");
    expect(plan.find((p) => p.type === "plazo")!.date).toBe(addBusinessDaysCR("2026-04-01", 5));
    expect(addBusinessDaysCR("2026-04-01", 1)).toBe("2026-04-06");
  });
});
