import { describe, expect, it } from "vitest";
import {
  buildDigestEmail,
  describeMailError,
  buildSubject,
  escapeHtml,
  groupByRecipient,
  parseHour,
  parseOffsets,
  pickReminder,
  type DueItem,
} from "../src/lib/reminders/logic";

const OFFSETS = [7, 3, 1, 0, -1];
const pick = (over: Partial<Parameters<typeof pickReminder>[0]>) =>
  pickReminder({ daysUntil: 5, kind: "plazo", completed: false, offsets: OFFSETS, sentOffsets: [], ...over });

describe("parseOffsets / parseHour", () => {
  it("usa los valores por defecto si no hay configuración o es inválida", () => {
    expect(parseOffsets(undefined)).toEqual([7, 3, 1, 0, -1]);
    expect(parseOffsets("")).toEqual([7, 3, 1, 0, -1]);
    expect(parseOffsets("abc, ,x")).toEqual([7, 3, 1, 0, -1]);
  });
  it("ordena de mayor a menor, quita duplicados y descarta fuera de rango", () => {
    expect(parseOffsets("1, 14, 3,3, 99, -2, -40")).toEqual([14, 3, 1, -2]);
  });
  it("valida la hora", () => {
    expect(parseHour("9")).toBe(9);
    expect(parseHour("24")).toBe(8);
    expect(parseHour("x")).toBe(8);
    expect(parseHour(undefined)).toBe(8);
  });
});

describe("pickReminder", () => {
  it("no avisa si falta más que la antelación mayor", () => {
    expect(pick({ daysUntil: 8 })).toBeNull();
  });
  it("avisa exactamente en cada antelación configurada", () => {
    expect(pick({ daysUntil: 7 })).toBe(7);
    expect(pick({ daysUntil: 3, sentOffsets: [7] })).toBe(3);
    expect(pick({ daysUntil: 1, sentOffsets: [7, 3] })).toBe(1);
    expect(pick({ daysUntil: 0, sentOffsets: [7, 3, 1] })).toBe(0);
  });
  it("no repite un aviso ya enviado", () => {
    expect(pick({ daysUntil: 7, sentOffsets: [7] })).toBeNull();
    expect(pick({ daysUntil: 3, sentOffsets: [3] })).toBeNull();
  });
  it("entre dos antelaciones no envía nada nuevo", () => {
    expect(pick({ daysUntil: 5, sentOffsets: [7] })).toBeNull();
    expect(pick({ daysUntil: 2, sentOffsets: [7, 3] })).toBeNull();
  });
  it("recupera el aviso si el servidor estuvo caído, enviando solo el más urgente", () => {
    // Evento creado con 2 días de margen: tocaría 7 y 3, se envía solo el 3.
    expect(pick({ daysUntil: 2 })).toBe(3);
    // Y no vuelve a enviarse el 7 después.
    expect(pick({ daysUntil: 2, sentOffsets: [3] })).toBeNull();
    expect(pick({ daysUntil: 1, sentOffsets: [3] })).toBe(1);
  });
  it("no retrocede a un aviso menos urgente que uno ya enviado", () => {
    expect(pick({ daysUntil: 0, sentOffsets: [0] })).toBeNull();
    expect(pick({ daysUntil: 3, sentOffsets: [1] })).toBeNull();
  });
  it("no avisa de eventos completados", () => {
    expect(pick({ daysUntil: 1, completed: true })).toBeNull();
    expect(pick({ daysUntil: -2, completed: true })).toBeNull();
  });
  it("avisa de vencido una sola vez en plazos y tareas", () => {
    expect(pick({ daysUntil: -1 })).toBe(-1);
    expect(pick({ daysUntil: -3, kind: "tarea" })).toBe(-1);
    expect(pick({ daysUntil: -3, sentOffsets: [7, 3, 1, 0] })).toBe(-1);
    expect(pick({ daysUntil: -3, sentOffsets: [-1] })).toBeNull();
  });
  it("no avisa de vencido en audiencias ni reuniones pasadas", () => {
    expect(pick({ daysUntil: -1, kind: "audiencia" })).toBeNull();
    expect(pick({ daysUntil: -1, kind: "reunion" })).toBeNull();
  });
  it("no avisa de vencidos antiguos (ventana de 7 días)", () => {
    expect(pick({ daysUntil: -7 })).toBe(-1);
    expect(pick({ daysUntil: -8 })).toBeNull();
  });
  it("sin antelaciones negativas configuradas no hay avisos de vencido", () => {
    expect(pick({ daysUntil: -2, offsets: [7, 3, 1, 0] })).toBeNull();
  });
});

const item = (over: Partial<DueItem> = {}): DueItem => ({
  eventId: 1,
  title: "Presentar demanda",
  kind: "plazo",
  startsAt: new Date(2026, 10, 20, 10, 0),
  endsAt: null,
  location: null,
  matterId: 7,
  matterNumber: "EXP-2026-0007",
  daysUntil: 6,
  offset: 7,
  eventDate: "2026-11-20",
  ...over,
});
const ana = { id: 1, name: "Ana", email: "ana@x.test" };
const luis = { id: 2, name: "Luis", email: "luis@x.test" };

describe("groupByRecipient", () => {
  it("agrupa por destinatario y ordena vencidos primero", () => {
    const groups = groupByRecipient([
      { recipient: ana, item: item({ eventId: 1, daysUntil: 3 }) },
      { recipient: luis, item: item({ eventId: 2, daysUntil: 1 }) },
      { recipient: ana, item: item({ eventId: 3, daysUntil: -2 }) },
      { recipient: ana, item: item({ eventId: 4, daysUntil: 0 }) },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.eventId)).toEqual([3, 4, 1]);
    expect(groups[1].items.map((i) => i.eventId)).toEqual([2]);
  });
});

describe("correo", () => {
  it("asunto con recuento por tipo", () => {
    expect(buildSubject([item({ daysUntil: -1 }), item({ daysUntil: 0 }), item({ daysUntil: 3 }), item({ daysUntil: 5 })])).toBe(
      "Recordatorio de agenda: 1 vencido, 1 para hoy, 2 próximos",
    );
    expect(buildSubject([item({ daysUntil: 3 })])).toBe("Recordatorio de agenda: 1 próximo");
  });

  it("incluye fecha, hora, expediente, enlace y antelación real", () => {
    const e = buildDigestEmail({ recipientName: "Ana", items: [item({ daysUntil: 6, location: "Sala 3" })], appUrl: "https://app.test/", firmName: "Bufete X" });
    expect(e.text).toContain("Hola Ana");
    expect(e.text).toContain("[Plazo] Presentar demanda — 20/11/2026 10:00 (en 6 días) · EXP-2026-0007 · Sala 3");
    expect(e.text).toContain("https://app.test/expedientes/7?tab=agenda");
    expect(e.html).toContain('href="https://app.test/expedientes/7?tab=agenda"');
  });

  it("los eventos sin expediente enlazan a la agenda", () => {
    const e = buildDigestEmail({ recipientName: "Ana", items: [item({ matterId: null, matterNumber: null })], appUrl: "https://app.test", firmName: "B" });
    expect(e.text).toContain("https://app.test/agenda");
    expect(e.text).not.toContain("null");
  });

  it("escapa HTML en títulos, nombres y lugares (inyección)", () => {
    const evil = `<script>alert("x")</script> & "co"`;
    const e = buildDigestEmail({ recipientName: evil, items: [item({ title: evil, location: evil })], appUrl: "https://app.test", firmName: evil });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).toContain("&amp;");
  });

  it("separa las secciones según urgencia", () => {
    const e = buildDigestEmail({ recipientName: "Ana", items: [item({ daysUntil: -1 }), item({ daysUntil: 0 }), item({ daysUntil: 2 })], appUrl: "https://app.test", firmName: "B" });
    const iV = e.text.indexOf("VENCIDOS SIN COMPLETAR"), iH = e.text.indexOf("PARA HOY"), iP = e.text.indexOf("PRÓXIMOS");
    expect(iV).toBeGreaterThan(-1);
    expect(iV).toBeLessThan(iH);
    expect(iH).toBeLessThan(iP);
  });

  it("escapeHtml cubre los cinco caracteres", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("describeMailError", () => {
  it("oculta la contraseña SMTP si el servidor la repite", () => {
    const err = Object.assign(new Error("535 Auth failed for pass=Sup3rSecreta!"), { code: "EAUTH" });
    const msg = describeMailError(err, "Sup3rSecreta!");
    expect(msg).not.toContain("Sup3rSecreta!");
    expect(msg).toBe("EAUTH: 535 Auth failed for pass=***");
  });
  it("omite el código genérico EMESSAGE y conserva los útiles", () => {
    expect(describeMailError(Object.assign(new Error("Message failed: 451 x"), { code: "EMESSAGE" }))).toBe("Message failed: 451 x");
    expect(describeMailError(Object.assign(new Error("connect ECONNREFUSED 1.2.3.4:25"), { code: "ECONNREFUSED" }))).toBe("connect ECONNREFUSED 1.2.3.4:25");
    expect(describeMailError(Object.assign(new Error("Greeting never received"), { code: "ETIMEDOUT" }))).toBe("ETIMEDOUT: Greeting never received");
  });
  it("una sola línea y acotado", () => {
    const msg = describeMailError(new Error("a\nb\n" + "x".repeat(1000)));
    expect(msg).not.toContain("\n");
    expect(msg.length).toBeLessThanOrEqual(300);
  });
  it("no se rompe con errores que no son Error", () => {
    expect(describeMailError("boom")).toBe("boom");
    expect(describeMailError(null)).toBe("null");
  });
});
