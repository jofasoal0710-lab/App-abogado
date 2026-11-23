import { describe, expect, it } from "vitest";
import { billableMinutes, elapsedSeconds, formatClock, roundingStep } from "../src/lib/timer";

describe("cronómetro", () => {
  const t0 = new Date("2026-11-23T10:00:00Z");
  it("suma lo acumulado y el tramo en marcha", () => {
    expect(elapsedSeconds({ startedAt: t0, accumulatedSeconds: 0 }, new Date("2026-11-23T10:30:15Z"))).toBe(1815);
    expect(elapsedSeconds({ startedAt: null, accumulatedSeconds: 600 }, new Date("2026-11-23T12:00:00Z"))).toBe(600);
    expect(elapsedSeconds({ startedAt: t0, accumulatedSeconds: 60 }, new Date("2026-11-23T10:01:00Z"))).toBe(120);
    expect(elapsedSeconds({ startedAt: t0, accumulatedSeconds: 0 }, new Date("2026-11-23T09:00:00Z"))).toBe(0);
  });
  it("redondea hacia arriba al tramo, con un tramo como mínimo", () => {
    expect(billableMinutes(10, 6)).toBe(6);
    expect(billableMinutes(6 * 60, 6)).toBe(6);
    expect(billableMinutes(6 * 60 + 1, 6)).toBe(12);
    expect(billableMinutes(47 * 60, 15)).toBe(60);
    expect(billableMinutes(47 * 60 + 30, 1)).toBe(48);
    expect(billableMinutes(0, 1)).toBe(1);
  });
  it("tramo configurable con valor seguro por defecto", () => {
    expect(roundingStep(undefined)).toBe(6);
    expect(roundingStep("15")).toBe(15);
    expect(roundingStep("0")).toBe(6);
    expect(roundingStep("abc")).toBe(6);
    expect(roundingStep("90")).toBe(6);
  });
  it("formato de reloj", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(725)).toBe("12:05");
    expect(formatClock(3909)).toBe("1:05:09");
  });
});
