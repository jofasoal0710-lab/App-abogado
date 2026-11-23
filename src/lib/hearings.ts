/**
 * Audiencias: tipos, choques de horario y exportación a calendario (iCalendar, RFC 5545). Puro.
 */

export const HEARING_TYPES = [
  "Audiencia preliminar",
  "Audiencia de juicio / complementaria",
  "Audiencia única (proceso sumario o monitorio)",
  "Conciliación",
  "Audiencia de recepción de prueba",
  "Audiencia de medidas cautelares",
  "Audiencia de debate (penal)",
  "Audiencia temprana / preliminar penal",
  "Audiencia de familia",
  "Comparecencia administrativa",
  "Otra",
] as const;

export const HEARING_MODES = { presencial: "Presencial", virtual: "Virtual", mixta: "Mixta" } as const;
export type HearingMode = keyof typeof HEARING_MODES;

/** Enlace de sala virtual: solo https (nunca javascript:, data:…). Devuelve null si no es válido. */
export function safeMeetingUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Duración por defecto de una audiencia sin hora de fin, para calcular choques y exportar. */
export const DEFAULT_HEARING_MINUTES = 120;

type Slot = { startsAt: Date; endsAt: Date | null };
const endOf = (s: Slot) => s.endsAt ?? new Date(s.startsAt.getTime() + DEFAULT_HEARING_MINUTES * 60_000);

/** ¿Se solapan dos audiencias? (si una no tiene fin, se supone que dura dos horas) */
export function overlaps(a: Slot, b: Slot): boolean {
  return a.startsAt < endOf(b) && b.startsAt < endOf(a);
}

/* ---------------- iCalendar ---------------- */

export type IcsEvent = {
  uid: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay?: boolean;
  summary: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  updatedAt?: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");
const utcStamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Escapa texto según RFC 5545 (\\ ; , y saltos de línea). */
export function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Pliega líneas a 75 octetos (continuación con un espacio), sin partir caracteres UTF-8. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(events: IcsEvent[], calendarName: string, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//App-abogado//Agenda judicial//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(calendarName)}`,
    "X-WR-TIMEZONE:America/Costa_Rica",
  ];
  for (const e of events) {
    const end = e.endsAt ?? new Date(e.startsAt.getTime() + (e.allDay ? 0 : DEFAULT_HEARING_MINUTES * 60_000));
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(e.updatedAt ?? now)}`);
    if (e.allDay) {
      const d = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}`;
      const next = new Date(e.startsAt.getTime() + 86_400_000);
      lines.push(`DTSTART;VALUE=DATE:${d(e.startsAt)}`, `DTEND;VALUE=DATE:${d(next)}`);
    } else {
      lines.push(`DTSTART:${utcStamp(e.startsAt)}`, `DTEND:${utcStamp(end)}`);
    }
    lines.push(`SUMMARY:${icsText(e.summary)}`);
    if (e.location) lines.push(`LOCATION:${icsText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio", "TRIGGER:-PT1H", "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/* ---------------- Contenido de cada evento en el calendario ---------------- */

export type CalendarRow = {
  id: number;
  kind: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  hearingType: string | null;
  hearingMode: string | null;
  meetingUrl: string | null;
  matterNumber: string | null;
  court: string | null;
  visibility: string | null;
};

const KIND_LABEL: Record<string, string> = { audiencia: "Audiencia", plazo: "Vence plazo", reunion: "Reunión", tarea: "Tarea" };

/**
 * Lo que se publica en el calendario externo (Google, Outlook…). De un expediente CONFIDENCIAL solo
 * sale el tipo y la hora: ni título, ni lugar, ni número, ni enlace (el proveedor del calendario lo guarda).
 * Las notas nunca se publican.
 */
export function toIcsEvent(e: CalendarRow, appUrl: string): IcsEvent {
  const kind = KIND_LABEL[e.kind] ?? "Evento";
  const allDay = e.kind === "plazo" && e.startsAt.getHours() === 0 && e.startsAt.getMinutes() === 0;
  const base = { uid: `evento-${e.id}@app-abogado`, startsAt: e.startsAt, endsAt: e.endsAt, allDay, url: `${appUrl}/agenda/${e.id}/editar` };
  if (e.visibility === "confidencial") return { ...base, summary: `${kind} (expediente confidencial)`, description: "Detalles en la aplicación del despacho." };
  const mode = e.hearingMode ? (HEARING_MODES as Record<string, string>)[e.hearingMode] : null;
  const summary = [e.kind === "audiencia" ? e.hearingType || "Audiencia" : kind, e.title, e.matterNumber].filter(Boolean).join(" · ");
  const description = [
    e.matterNumber && `Expediente: ${e.matterNumber}`,
    e.court && `Despacho: ${e.court}`,
    mode && `Modalidad: ${mode}`,
    e.meetingUrl && `Sala virtual: ${e.meetingUrl}`,
  ].filter(Boolean).join("\n");
  return { ...base, summary, location: e.meetingUrl && e.hearingMode === "virtual" ? e.meetingUrl : e.location, description: description || null };
}
