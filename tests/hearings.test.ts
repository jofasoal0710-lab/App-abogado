import { describe, expect, it } from "vitest";
import { buildIcs, foldLine, icsText, overlaps, safeMeetingUrl } from "../src/lib/hearings";

describe("audiencias", () => {
  it("choques de horario (sin fin = 2 horas)", () => {
    const a = { startsAt: new Date("2026-12-01T09:00:00-06:00"), endsAt: null };
    expect(overlaps(a, { startsAt: new Date("2026-12-01T10:30:00-06:00"), endsAt: null })).toBe(true);
    expect(overlaps(a, { startsAt: new Date("2026-12-01T11:00:00-06:00"), endsAt: null })).toBe(false);
    expect(overlaps(a, { startsAt: new Date("2026-12-01T08:00:00-06:00"), endsAt: new Date("2026-12-01T09:00:00-06:00") })).toBe(false);
  });
  it("enlace de sala virtual: solo https", () => {
    expect(safeMeetingUrl("https://teams.microsoft.com/l/meetup/abc")).toContain("https://teams.microsoft.com");
    expect(safeMeetingUrl("javascript:alert(1)")).toBeNull();
    expect(safeMeetingUrl("http://ejemplo.cr")).toBeNull();
    expect(safeMeetingUrl("")).toBeNull();
  });
});

describe("iCalendar", () => {
  it("escapa y pliega líneas largas sin romper tildes", () => {
    expect(icsText("Juzgado; Sala 2, San José\nPiso 3")).toBe("Juzgado\; Sala 2\\, San José\\nPiso 3");
    const f = foldLine("SUMMARY:" + "ñ".repeat(60));
    expect(f.split("\r\n ").every((l) => Buffer.byteLength(l, "utf8") <= 75)).toBe(true);
    expect(f.replace(/\r\n /g, "")).toBe("SUMMARY:" + "ñ".repeat(60));
  });
  it("genera un VEVENT en UTC con alarma", () => {
    const ics = buildIcs([{ uid: "evento-7@app-abogado", startsAt: new Date("2026-12-01T09:00:00-06:00"), endsAt: null, summary: "Audiencia preliminar · EXP-2026-0003", location: "Juzgado de Trabajo, Sala 2" }], "Mis audiencias", new Date("2026-11-23T00:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261201T150000Z");
    expect(ics).toContain("DTEND:20261201T170000Z");
    expect(ics).toContain("LOCATION:Juzgado de Trabajo\\, Sala 2");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

import { toIcsEvent } from "../src/lib/hearings";
describe("contenido publicado en el calendario", () => {
  const base = { id: 9, kind: "audiencia", title: "Juicio de Pérez", startsAt: new Date("2026-12-01T09:00:00-06:00"), endsAt: null, location: "Juzgado de Trabajo, Sala 2", hearingType: "Audiencia preliminar", hearingMode: "presencial", meetingUrl: null, matterNumber: "EXP-2026-0003", court: "Juzgado de Trabajo de San José", visibility: "abierto" };
  it("audiencia normal: tipo, título, expediente y despacho", () => {
    const e = toIcsEvent(base, "https://app.cr");
    expect(e.summary).toBe("Audiencia preliminar · Juicio de Pérez · EXP-2026-0003");
    expect(e.description).toContain("Despacho: Juzgado de Trabajo de San José");
    expect(e.url).toBe("https://app.cr/agenda/9/editar");
  });
  it("virtual: el lugar es el enlace", () => {
    expect(toIcsEvent({ ...base, hearingMode: "virtual", meetingUrl: "https://teams.microsoft.com/x" }, "https://app.cr").location).toBe("https://teams.microsoft.com/x");
  });
  it("confidencial: sin título, lugar, número ni enlace", () => {
    const e = toIcsEvent({ ...base, visibility: "confidencial", meetingUrl: "https://teams.microsoft.com/x" }, "https://app.cr");
    expect(e.summary).toBe("Audiencia (expediente confidencial)");
    expect(JSON.stringify(e)).not.toMatch(/Pérez|EXP-2026|Sala 2|teams/);
  });
});
