import { describe, expect, it } from "vitest";
import { businessDaysUntil } from "../src/lib/cr-holidays";
import { countdown, urgencyOf } from "../src/lib/deadlines";

describe("semáforo de plazos", () => {
  it("niveles de urgencia", () => {
    expect(urgencyOf(-1, false)).toBe("vencido");
    expect(urgencyOf(0, false)).toBe("hoy");
    expect(urgencyOf(2, false)).toBe("pronto");
    expect(urgencyOf(5, false)).toBe("semana");
    expect(urgencyOf(12, false)).toBe("luego");
    expect(urgencyOf(-3, true)).toBe("hecho");
  });
  it("cuenta regresiva en días hábiles (con feriados)", () => {
    expect(businessDaysUntil("2026-11-27", "2026-12-04")).toBe(4); // 30, (1 dic feriado), 2, 3, 4
    expect(countdown("2026-12-04", "2026-11-27", 7, false)).toBe("faltan 4 días hábiles (7 naturales)");
    expect(countdown("2026-11-28", "2026-11-27", 1, false)).toBe("vence mañana");
    expect(countdown("2026-11-25", "2026-11-27", -2, false)).toBe("venció hace 2 días");
    expect(countdown("2026-11-27", "2026-11-27", 0, false)).toBe("vence hoy");
  });
});
