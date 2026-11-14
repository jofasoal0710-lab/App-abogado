/**
 * Lógica pura de los recordatorios (sin base de datos ni correo): decide qué aviso toca
 * para cada evento y construye el correo. Todo lo que tiene efectos vive en runner.ts.
 */
import { daysUntil, formatDate, formatTime, relativeDays } from "../dates";
import { eventKindLabels } from "../labels";

export type EventKind = keyof typeof eventKindLabels;

export const DEFAULT_OFFSETS = [7, 3, 1, 0, -1];
/** Un plazo/tarea vencido deja de avisarse pasados estos días (evita inundar con histórico). */
export const OVERDUE_WINDOW_DAYS = 7;
export const MAX_ATTEMPTS = 3;

/** "7,3,1,0,-1" → [7,3,1,0,-1]. Valores no válidos se ignoran; si no queda ninguno, los de por defecto. */
export function parseOffsets(raw: string | undefined): number[] {
  if (raw === undefined || raw.trim() === "") return [...DEFAULT_OFFSETS];
  const values = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^-?\d+$/.test(s))
    .map(Number)
    .filter((n) => n >= -OVERDUE_WINDOW_DAYS && n <= 60);
  const unique = [...new Set(values)].sort((a, b) => b - a);
  return unique.length ? unique : [...DEFAULT_OFFSETS];
}

export function parseHour(raw: string | undefined, fallback = 8): number {
  if (raw === undefined || !/^\d{1,2}$/.test(raw.trim())) return fallback;
  const n = Number(raw);
  return n >= 0 && n <= 23 ? n : fallback;
}

/** Los avisos de "vencido" solo tienen sentido en cosas que hay que hacer, no en reuniones/audiencias pasadas. */
export function canBeOverdue(kind: EventKind): boolean {
  return kind === "plazo" || kind === "tarea";
}

/**
 * Qué aviso (antelación en días) corresponde enviar ahora a un evento, o null si ninguno.
 *
 * Un aviso con antelación `o` "vence" cuando faltan `o` días o menos. Si hay varios vencidos
 * se envía solo el más urgente (el menor `o`), y nunca se envía uno igual o menos urgente
 * que otro ya enviado. Así, si el servidor estuvo caído el día exacto, el aviso se recupera,
 * pero no se repiten avisos ya superados.
 */
export function pickReminder(input: {
  daysUntil: number;
  kind: EventKind;
  completed: boolean;
  offsets: number[];
  sentOffsets: number[];
}): number | null {
  const { daysUntil: d, kind, completed, offsets, sentOffsets } = input;
  if (completed) return null;

  if (d < 0) {
    if (!canBeOverdue(kind) || d < -OVERDUE_WINDOW_DAYS) return null;
  }
  // Pasado el evento solo cuentan los avisos de vencido (negativos); antes, los demás.
  const candidates = offsets.filter((o) => o >= d && (d >= 0 || o < 0));
  if (candidates.length === 0) return null;

  const chosen = Math.min(...candidates);
  if (sentOffsets.some((s) => s <= chosen)) return null;
  return chosen;
}

/* ---------- Agrupación y correo ---------- */

export type DueItem = {
  eventId: number;
  title: string;
  kind: EventKind;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  matterId: number | null;
  matterNumber: string | null;
  daysUntil: number;
  /** Antelación configurada que originó este aviso (clave del registro). */
  offset: number;
  /** Día del evento en el momento del aviso (YYYY-MM-DD). */
  eventDate: string;
};

export type Recipient = { id: number; name: string; email: string };
export type RecipientGroup = { recipient: Recipient; items: DueItem[] };

export function groupByRecipient(entries: { recipient: Recipient; item: DueItem }[]): RecipientGroup[] {
  const map = new Map<number, RecipientGroup>();
  for (const { recipient, item } of entries) {
    const group = map.get(recipient.id) ?? { recipient, items: [] };
    group.items.push(item);
    map.set(recipient.id, group);
  }
  return [...map.values()].map((g) => ({
    ...g,
    // Vencidos primero, luego por cercanía.
    items: g.items.sort((a, b) => a.daysUntil - b.daysUntil || a.startsAt.getTime() - b.startsAt.getTime()),
  }));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildSubject(items: DueItem[]): string {
  const overdue = items.filter((i) => i.daysUntil < 0).length;
  const today = items.filter((i) => i.daysUntil === 0).length;
  const upcoming = items.length - overdue - today;
  const parts: string[] = [];
  if (overdue) parts.push(plural(overdue, "vencido", "vencidos"));
  if (today) parts.push(plural(today, "para hoy", "para hoy"));
  if (upcoming) parts.push(plural(upcoming, "próximo", "próximos"));
  return `Recordatorio de agenda: ${parts.join(", ")}`;
}

function sectionOf(item: DueItem): "vencidos" | "hoy" | "proximos" {
  return item.daysUntil < 0 ? "vencidos" : item.daysUntil === 0 ? "hoy" : "proximos";
}

const SECTION_TITLES = { vencidos: "Vencidos sin completar", hoy: "Para hoy", proximos: "Próximos" } as const;

function itemLine(item: DueItem) {
  const when = `${formatDate(item.startsAt)} ${formatTime(item.startsAt)}`;
  const extra = [item.matterNumber, item.location].filter(Boolean).join(" · ");
  return { kind: eventKindLabels[item.kind], when, rel: relativeDays(item.daysUntil), extra };
}

function linkFor(appUrl: string, item: DueItem) {
  const base = appUrl.replace(/\/+$/, "");
  return item.matterId ? `${base}/expedientes/${item.matterId}?tab=agenda` : `${base}/agenda`;
}

export function buildDigestEmail(input: {
  recipientName: string;
  items: DueItem[];
  appUrl: string;
  firmName: string;
}): { subject: string; text: string; html: string } {
  const { recipientName, items, appUrl, firmName } = input;
  const subject = buildSubject(items);
  const sections = (["vencidos", "hoy", "proximos"] as const)
    .map((key) => ({ key, items: items.filter((i) => sectionOf(i) === key) }))
    .filter((s) => s.items.length > 0);

  const text =
    [
      `Hola ${recipientName},`,
      "",
      "Estos son tus plazos y eventos pendientes:",
      ...sections.flatMap((s) => [
        "",
        SECTION_TITLES[s.key].toUpperCase(),
        ...s.items.map((i) => {
          const l = itemLine(i);
          return `- [${l.kind}] ${i.title} — ${l.when} (${l.rel})${l.extra ? ` · ${l.extra}` : ""}\n  ${linkFor(appUrl, i)}`;
        }),
      ]),
      "",
      `Agenda completa: ${appUrl.replace(/\/+$/, "")}/agenda`,
      "",
      `${firmName} · Recibes este aviso porque tienes activados los recordatorios por correo.`,
    ].join("\n") + "\n";

  const color = { vencidos: "#b91c1c", hoy: "#b45309", proximos: "#1d3d6e" } as const;
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2530">
<div style="max-width:620px;margin:0 auto;padding:24px">
<h1 style="font-family:Georgia,serif;font-size:20px;margin:0 0 4px">${escapeHtml(firmName)}</h1>
<p style="margin:0 0 20px;color:#5d6879;font-size:14px">Hola ${escapeHtml(recipientName)}, estos son tus plazos y eventos pendientes.</p>
${sections
  .map(
    (s) => `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:${color[s.key]};margin:20px 0 8px">${SECTION_TITLES[s.key]}</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #d9dde5;border-radius:8px">
${s.items
  .map((i) => {
    const l = itemLine(i);
    return `<tr><td style="padding:12px 14px;border-bottom:1px solid #eceef2">
<div style="font-size:12px;color:#5d6879">${escapeHtml(l.kind)} · ${escapeHtml(l.when)} · <strong style="color:${color[s.key]}">${escapeHtml(l.rel)}</strong></div>
<div style="font-size:15px;font-weight:bold;margin:2px 0"><a href="${escapeHtml(linkFor(appUrl, i))}" style="color:#1d3d6e;text-decoration:none">${escapeHtml(i.title)}</a></div>
${l.extra ? `<div style="font-size:12px;color:#5d6879">${escapeHtml(l.extra)}</div>` : ""}
</td></tr>`;
  })
  .join("\n")}
</table>`,
  )
  .join("\n")}
<p style="margin:24px 0 0;font-size:12px;color:#8892a5">Recibes este aviso porque tienes activados los recordatorios por correo.<br><a href="${escapeHtml(appUrl.replace(/\/+$/, ""))}/agenda" style="color:#2f5fa8">Abrir la agenda</a></p>
</div></body></html>`;

  return { subject, text, html };
}

/** Días hasta el evento, calculados en la zona horaria del proceso. */
export function daysUntilEvent(startsAt: Date, now: Date): number {
  return daysUntil(startsAt, now);
}

/**
 * Mensaje de error apto para guardar y mostrar: una sola línea, acotado y sin la contraseña
 * SMTP (algunos servidores la repiten en sus respuestas). Se omiten códigos genéricos de nodemailer.
 */
export function describeMailError(err: unknown, secret = ""): string {
  let msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code;
  if (secret) msg = msg.split(secret).join("***");
  msg = msg.replace(/\s+/g, " ").trim().slice(0, 300);
  const generic = !code || code === "EMESSAGE" || code === "EENVELOPE";
  return generic || msg.includes(code) ? msg : `${code}: ${msg}`;
}
