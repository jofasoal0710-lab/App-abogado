import "server-only";
import { and, count, eq, ne, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { clients, intakeRequests, intakeSettings, matters, roles, users, type IntakeRequest } from "@/db/schema";
import { clientAccessSql, matterAccessSql } from "./access";
import type { AccessUser } from "./access-rules";
import { nameTokens, namesMatch } from "./intake";
import { areaLabels } from "./labels";
import { getReminderConfig, isSmtpConfigured } from "./reminders/config";
import { escapeHtml } from "./reminders/logic";
import { describeMailError, sendMail } from "./reminders/mailer";

export async function getIntakeSettings(): Promise<{ enabled: boolean; intro: string | null }> {
  const [row] = await db.select({ enabled: intakeSettings.enabled, intro: intakeSettings.intro }).from(intakeSettings).where(eq(intakeSettings.id, 1));
  return row ?? { enabled: false, intro: null };
}

export async function pendingIntakeCount(): Promise<number> {
  const [r] = await db.select({ n: count() }).from(intakeRequests).where(eq(intakeRequests.status, "pendiente"));
  return r?.n ?? 0;
}

/** Comparación sin mayúsculas ni tildes, en SQL (para preseleccionar candidatos; luego se afina con namesMatch). */
const folded = (col: SQLWrapper) => sql`translate(lower(${col}), 'áéíóúüàèìòùñ', 'aeiouuaeioun')`;
function anyTokenLike(col: SQLWrapper, tokens: string[]): SQL | undefined {
  if (!tokens.length) return undefined;
  // La palabra más larga basta para preseleccionar: es la más discriminante.
  const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
  return sql`${folded(col)} like ${"%" + longest + "%"}`;
}

export type ConflictHit = {
  kind: "cliente" | "contraparte" | "contraparte_es_cliente" | "solicitud";
  /** Qué se buscó («La persona que consulta» / «La parte contraria»). */
  about: string;
  /** Qué coincide, para mostrar. Si no hay acceso, sin detalles. */
  label: string;
  href?: string;
  /** Coincidencia por identificación (más fuerte que por nombre). */
  byId?: boolean;
  restricted?: boolean;
  /** Si es un cliente visible: su id y nombre (para ofrecerlo al aceptar y no duplicar la ficha). */
  clientId?: number;
  clientName?: string;
};

/**
 * Búsqueda de conflictos de interés para una solicitud: ¿quien consulta ya es cliente? ¿es la parte
 * contraria en algún expediente? ¿la parte contraria que indica es cliente del despacho? ¿hubo solicitudes
 * anteriores? Respeta la confidencialidad: de lo que no se puede ver se avisa sin dar detalles.
 */
export async function findConflicts(user: AccessUser, req: Pick<IntakeRequest, "id" | "name" | "taxId" | "email" | "opposingParty">): Promise<ConflictHit[]> {
  const hits: ConflictHit[] = [];
  const who = "La persona que consulta";
  const other = "La parte contraria";
  const reqTokens = nameTokens(req.name);
  const oppTokens = req.opposingParty ? nameTokens(req.opposingParty) : [];

  // 1) ¿Ya es cliente? (por cédula o por nombre)
  const byName = anyTokenLike(clients.name, reqTokens);
  const conds = [req.taxId ? eq(clients.taxId, req.taxId) : undefined, byName, req.email ? sql`lower(${clients.email}) = ${req.email.toLowerCase()}` : undefined].filter(Boolean) as SQL[];
  if (conds.length) {
    const rows = await db
      .select({ id: clients.id, name: clients.name, taxId: clients.taxId, email: clients.email, visible: sql<boolean>`${clientAccessSql(user, clients.id)}` })
      .from(clients)
      .where(or(...conds))
      .limit(50);
    for (const c of rows) {
      const byId = !!req.taxId && c.taxId === req.taxId;
      const byMail = !!req.email && c.email?.toLowerCase() === req.email.toLowerCase();
      if (!byId && !byMail && !namesMatch(req.name, c.name)) continue;
      hits.push(c.visible ? { kind: "cliente", about: who, label: `Ya es cliente: ${c.name}${byId ? " (misma identificación)" : byMail ? " (mismo correo)" : ""}`, href: `/clientes/${c.id}`, byId: byId || byMail, clientId: c.id, clientName: c.name } : { kind: "cliente", about: who, label: "Coincide con un cliente confidencial al que no tienes acceso. Consulta con su responsable o con administración.", byId: byId || byMail, restricted: true });
    }
  }

  // 2) ¿Es la parte contraria en un expediente nuestro? (conflicto directo)
  const oppLike = anyTokenLike(sql`coalesce(${matters.opposingParty}, '')`, reqTokens);
  if (oppLike) {
    const rows = await db
      .select({ id: matters.id, number: matters.number, title: matters.title, opposingParty: matters.opposingParty, responsible: users.name, visible: sql<boolean>`${matterAccessSql(user, matters.id)}` })
      .from(matters)
      .leftJoin(users, eq(users.id, matters.responsibleId))
      .where(oppLike)
      .limit(50);
    for (const m of rows) {
      if (!m.opposingParty || !namesMatch(req.name, m.opposingParty)) continue;
      hits.push(m.visible ? { kind: "contraparte", about: who, label: `Es la parte contraria en ${m.number} — ${m.title}`, href: `/expedientes/${m.id}` } : { kind: "contraparte", about: who, label: `Es la parte contraria en un expediente al que no tienes acceso${m.responsible ? ` (responsable: ${m.responsible})` : ""}.`, restricted: true });
    }
  }

  // 3) ¿La parte contraria que indica es cliente del despacho?
  const oppClient = anyTokenLike(clients.name, oppTokens);
  if (oppClient && req.opposingParty) {
    const rows = await db
      .select({ id: clients.id, name: clients.name, visible: sql<boolean>`${clientAccessSql(user, clients.id)}` })
      .from(clients)
      .where(oppClient)
      .limit(50);
    for (const c of rows) {
      if (!namesMatch(req.opposingParty, c.name)) continue;
      hits.push(c.visible ? { kind: "contraparte_es_cliente", about: other, label: `«${req.opposingParty}» coincide con el cliente ${c.name}`, href: `/clientes/${c.id}` } : { kind: "contraparte_es_cliente", about: other, label: "La parte contraria coincide con un cliente confidencial al que no tienes acceso.", restricted: true });
    }
  }

  // 4) Solicitudes anteriores de la misma persona.
  const prevConds = [req.taxId ? eq(intakeRequests.taxId, req.taxId) : undefined, req.email ? eq(intakeRequests.email, req.email) : undefined, anyTokenLike(intakeRequests.name, reqTokens)].filter(Boolean) as SQL[];
  if (prevConds.length) {
    const rows = await db
      .select({ id: intakeRequests.id, name: intakeRequests.name, taxId: intakeRequests.taxId, email: intakeRequests.email, status: intakeRequests.status, createdAt: intakeRequests.createdAt })
      .from(intakeRequests)
      .where(and(ne(intakeRequests.id, req.id), or(...prevConds)))
      .limit(20);
    for (const r of rows) {
      const strong = (!!req.taxId && r.taxId === req.taxId) || r.email === req.email;
      if (!strong && !namesMatch(req.name, r.name)) continue;
      hits.push({ kind: "solicitud", about: who, label: `Envió otra solicitud el ${r.createdAt.toLocaleDateString("es-CR")} (${r.status})`, href: `/solicitudes/${r.id}`, byId: strong });
    }
  }
  return hits;
}

/** Texto de constancia de la revisión, para guardar al decidir. */
export function conflictSummaryText(hits: ConflictHit[], by: string): string {
  const when = new Date().toLocaleString("es-CR", { timeZone: process.env.TZ || "America/Costa_Rica" });
  if (!hits.length) return `Revisión de conflictos por ${by} el ${when}: sin coincidencias.`;
  return `Revisión de conflictos por ${by} el ${when}: ${hits.length} coincidencia(s) revisada(s) — ${hits.map((h) => h.label).join("; ")}`.slice(0, 4000);
}

/**
 * Aviso de solicitud nueva a quien puede revisarlas (activo y con los avisos por correo activados). El
 * correo no incluye el relato del caso: solo que hay una solicitud y de qué área, con el enlace.
 */
export async function notifyNewIntake(id: number, area: keyof typeof areaLabels): Promise<number> {
  const c = getReminderConfig();
  if (!isSmtpConfigured(c)) return 0;
  const people = await db
    .select({ email: users.email, name: users.name, systemKey: roles.systemKey, permissions: roles.permissions })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(users.active, true), eq(users.emailReminders, true)));
  const to = people.filter((p) => p.systemKey === "admin" || p.permissions.includes("solicitudes.gestionar"));
  const url = `${c.appUrl}/solicitudes/${id}`;
  let sent = 0;
  for (const p of to.slice(0, 20)) {
    try {
      await sendMail(c, {
        to: p.email,
        subject: `${c.firmName}: nueva solicitud de cliente (${areaLabels[area]})`,
        text: `Hola ${p.name}:\n\nHa llegado una solicitud nueva por el formulario público (${areaLabels[area]}).\nRevísala aquí: ${url}\n`,
        html: `<p>Hola ${escapeHtml(p.name)}:</p><p>Ha llegado una solicitud nueva por el formulario público (${escapeHtml(areaLabels[area])}).</p><p><a href="${escapeHtml(url)}">Revisar la solicitud</a></p>`,
      });
      sent++;
    } catch (err) {
      console.error("[solicitudes] No se pudo enviar el aviso:", describeMailError(err, c));
    }
  }
  return sent;
}

