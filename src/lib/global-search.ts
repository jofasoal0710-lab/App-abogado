import "server-only";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { clients, documents, invoices, matters, writings } from "@/db/schema";
import { clientAccessSql, invoiceAccessSql, matterAccessSql } from "./access";
import type { CurrentUser } from "./auth";
import { searchKnowledge } from "./knowledge";
import { searchArticles } from "./laws";
import { searchNorms } from "./normativa";
import { can } from "./permissions";
import { likePattern } from "./search";
import { TEMPLATES } from "./forms/templates";
import { writingAccessSql } from "./writings";

export type SearchHit = { group: string; label: string; detail?: string; href: string };

/** Acciones rápidas de la paleta (solo las que la persona puede usar). */
export function commandsFor(user: CurrentUser): SearchHit[] {
  const c: (SearchHit | false)[] = [
    { group: "Acciones", label: "Nuevo expediente", href: "/expedientes/nuevo" },
    can(user, "clientes.gestionar") && { group: "Acciones", label: "Nuevo cliente", href: "/clientes/nuevo" },
    { group: "Acciones", label: "Nuevo evento o plazo", href: "/agenda/nuevo" },
    { group: "Acciones", label: "Registrar horas", href: "/horas" },
    { group: "Acciones", label: "Generar escrito", href: "/formularios" },
    { group: "Acciones", label: "Subir documento", href: "/documentos/subir" },
    can(user, "facturacion.ver") && { group: "Acciones", label: "Nueva factura", href: "/facturas/nueva" },
    can(user, "notaria.usar") && { group: "Acciones", label: "Registrar escritura", href: "/notaria/escrituras/nueva" },
    { group: "Acciones", label: "Calcular liquidación laboral", href: "/herramientas#liquidacion" },
    { group: "Acciones", label: "Calcular vencimiento de un plazo", href: "/herramientas#plazo" },
    { group: "Acciones", label: "Nueva entrada de conocimiento", href: "/conocimiento/nueva" },
    { group: "Acciones", label: "Cambiar apariencia (colores, modo oscuro)", href: "/cuenta#apariencia" },
  ];
  return c.filter((x): x is SearchHit => !!x);
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Busca en todo lo que la persona puede ver. Cada grupo, como mucho unos pocos resultados. */
export async function globalSearch(user: CurrentUser, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 100);
  const cmds = commandsFor(user).filter((c) => !q || fold(c.label).includes(fold(q)));
  if (q.length < 2) return cmds.slice(0, 8);
  const like = likePattern(q);
  const [ms, cs, ws, inv, docs, kb, arts] = await Promise.all([
    db
      .select({ id: matters.id, number: matters.number, title: matters.title, client: clients.name })
      .from(matters)
      .innerJoin(clients, eq(clients.id, matters.clientId))
      .where(and(or(ilike(matters.title, like), ilike(matters.number, like), ilike(matters.courtCaseNumber, like), ilike(clients.name, like)), matterAccessSql(user, matters.id)))
      .orderBy(desc(matters.openedAt))
      .limit(6),
    db
      .select({ id: clients.id, name: clients.name, taxId: clients.taxId })
      .from(clients)
      .where(and(or(ilike(clients.name, like), ilike(clients.taxId, likePattern(q.replace(/\D/g, "") || q))), clientAccessSql(user, clients.id)))
      .limit(5),
    db
      .select({ id: writings.id, title: writings.title, number: matters.number })
      .from(writings)
      .leftJoin(matters, eq(matters.id, writings.matterId))
      .where(and(ilike(writings.title, like), writingAccessSql(user)))
      .orderBy(desc(writings.updatedAt))
      .limit(4),
    can(user, "facturacion.ver")
      ? db
          .select({ id: invoices.id, number: invoices.number, client: clients.name })
          .from(invoices)
          .innerJoin(clients, eq(clients.id, invoices.clientId))
          .where(and(or(ilike(invoices.number, like), ilike(clients.name, like)), invoiceAccessSql(user)))
          .orderBy(desc(invoices.id))
          .limit(4)
      : Promise.resolve([]),
    db
      .select({ id: documents.id, name: documents.name, number: matters.number })
      .from(documents)
      .innerJoin(matters, eq(matters.id, documents.matterId))
      .where(and(ilike(documents.name, like), matterAccessSql(user, documents.matterId)))
      .orderBy(desc(documents.createdAt))
      .limit(4),
    searchKnowledge(q, { limit: 3 }),
    searchArticles(q, { anyWords: true, limit: 3 }),
  ]);
  const forms = TEMPLATES.filter((t) => fold(t.title).includes(fold(q))).slice(0, 3);
  const norms = searchNorms(q).slice(0, 3);
  return [
    ...ms.map((m) => ({ group: "Expedientes", label: `${m.number} · ${m.title}`, detail: m.client, href: `/expedientes/${m.id}` })),
    ...cs.map((c) => ({ group: "Clientes", label: c.name, detail: c.taxId ?? undefined, href: `/clientes/${c.id}` })),
    ...ws.map((w) => ({ group: "Escritos", label: w.title, detail: w.number ?? undefined, href: `/escritos/${w.id}` })),
    ...inv.map((i) => ({ group: "Facturas", label: i.number ?? `Borrador #${i.id}`, detail: i.client, href: `/facturas/${i.id}` })),
    ...docs.map((d) => ({ group: "Documentos", label: d.name, detail: d.number, href: `/documentos/${d.id}` })),
    ...forms.map((t) => ({ group: "Formularios", label: t.title, detail: t.kind === "escrito" ? "Escrito" : "Escritura", href: `/formularios/${t.key}` })),
    ...kb.map((k) => ({ group: "Conocimiento", label: k.title, href: `/conocimiento?q=${encodeURIComponent(k.title)}#k${k.id}` })),
    ...arts.map((a) => ({ group: "Leyes", label: `Artículo ${a.number} · ${a.title}`, detail: a.snippet.replace(/\[\[|\]\]/g, "").slice(0, 90), href: `/normativa/${a.normKey}?art=${encodeURIComponent(a.number)}` })),
    ...norms.map((n) => ({ group: "Normativa", label: n.name, detail: n.number ? `Ley ${n.number}` : undefined, href: `/normativa?q=${encodeURIComponent(n.number ?? n.name)}` })),
    ...cmds.slice(0, 4),
  ];
}
