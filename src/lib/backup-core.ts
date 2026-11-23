/**
 * Copia de seguridad lógica de la base de datos (SEC-001): todas las tablas en un JSON comprimido.
 * Sin dependencias de Next.js: lo usan la app (lib/backup.ts) y el script de restauración
 * (scripts/restaurar-respaldo.ts). Se pasa una función de consulta de node-postgres.
 */
export type Query = (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

export const BACKUP_FORMAT = "app-abogado-respaldo";

/** Tablas que no se copian: sesiones y contadores de intentos (efímeros; restaurarlos no tiene sentido). */
export const BACKUP_SKIP = new Set(["sessions", "login_attempts"]);

export type BackupDump = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  createdAt: string;
  /** Última migración aplicada (la base destino debe tener la misma). */
  migration: { hash: string; created_at: string } | null;
  rows: number;
  tables: Record<string, Record<string, unknown>[]>;
};

const ident = (t: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(t)) throw new Error(`Nombre de tabla no válido: ${t}`);
  return `"${t}"`;
};

async function publicTables(q: Query): Promise<string[]> {
  const r = await q(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`);
  return r.rows.map((x) => String(x.relname));
}

async function lastMigration(q: Query): Promise<BackupDump["migration"]> {
  try {
    const r = await q(`select hash, created_at::text as created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`);
    return r.rows[0] ? { hash: String(r.rows[0].hash), created_at: String(r.rows[0].created_at) } : null;
  } catch {
    return null;
  }
}

export async function dumpDatabase(q: Query): Promise<BackupDump> {
  const tables: BackupDump["tables"] = {};
  let rows = 0;
  for (const t of await publicTables(q)) {
    if (BACKUP_SKIP.has(t)) continue;
    const r = await q(`select coalesce(json_agg(x), '[]'::json) as j from ${ident(t)} x`);
    tables[t] = r.rows[0].j as Record<string, unknown>[];
    rows += tables[t].length;
  }
  return { format: BACKUP_FORMAT, version: 1, createdAt: new Date().toISOString(), migration: await lastMigration(q), rows, tables };
}

/** Orden de inserción: primero las tablas a las que otras apuntan (claves foráneas). Puro; exportado para los tests. */
export function insertionOrder(tables: string[], edges: [child: string, parent: string][]): string[] {
  const set = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const [c, p] of edges) if (c !== p && set.has(c) && set.has(p)) deps.get(c)!.add(p);
  const done: string[] = [];
  const left = new Set(tables);
  while (left.size) {
    const ready = [...left].filter((t) => [...deps.get(t)!].every((p) => !left.has(p))).sort();
    if (!ready.length) throw new Error(`Claves foráneas circulares entre: ${[...left].join(", ")}`);
    for (const t of ready) {
      done.push(t);
      left.delete(t);
    }
  }
  return done;
}

export type RestoreResult = { tables: number; rows: number };

/**
 * Restaura una copia en la base de datos a la que apunta `q` (que debe estar en una transacción y con las
 * migraciones aplicadas). Sin `replace`, exige que las tablas estén vacías; con `replace`, las vacía antes.
 */
export async function restoreDatabase(q: Query, dump: BackupDump, opts: { replace?: boolean } = {}): Promise<RestoreResult> {
  if (dump.format !== BACKUP_FORMAT || dump.version !== 1) throw new Error("El fichero no es una copia de seguridad de esta aplicación.");
  const current = await lastMigration(q);
  if (dump.migration && current && dump.migration.hash !== current.hash) {
    throw new Error("La base de datos destino tiene otra versión del esquema: aplica antes las mismas migraciones que tenía la copia.");
  }
  const existing = new Set(await publicTables(q));
  const names = Object.keys(dump.tables).filter((t) => existing.has(t));
  const fk = await q(`select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent from pg_constraint c join pg_namespace n on n.oid = c.connamespace where c.contype = 'f' and n.nspname = 'public'`);
  const strip = (s: unknown) => String(s).replace(/^public\./, "").replace(/"/g, "");
  const order = insertionOrder(names, fk.rows.map((r) => [strip(r.child), strip(r.parent)]));

  // Sin --reemplazar solo se admite una base de datos sin datos reales (las migraciones crean los roles
  // y la configuración por defecto, que se sustituyen igualmente).
  if (!opts.replace) {
    for (const t of ["users", "clients", "matters"].filter((x) => order.includes(x))) {
      const r = await q(`select exists (select 1 from ${ident(t)}) as x`);
      if (r.rows[0].x) throw new Error(`La base de datos destino ya tiene datos (tabla «${t}»). Usa --reemplazar para sustituir todo su contenido.`);
    }
  }
  await q(`truncate ${order.map(ident).join(", ")} restart identity cascade`);

  let rows = 0;
  for (const t of order) {
    const data = dump.tables[t];
    if (!data.length) continue;
    const cols = (await q(`select attname from pg_attribute where attrelid = $1::regclass and attnum > 0 and not attisdropped and attgenerated = '' order by attnum`, [t])).rows.map((r) => `"${String(r.attname)}"`);
    const list = cols.join(", ");
    // Las filas con referencia a sí misma (p. ej. un padre en la misma tabla) van ordenadas por id.
    const sorted = [...data].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));
    for (let i = 0; i < sorted.length; i += 500) {
      await q(`insert into ${ident(t)} (${list}) overriding system value select ${list} from json_populate_recordset(null::${ident(t)}, $1::json)`, [JSON.stringify(sorted.slice(i, i + 500))]);
    }
    rows += data.length;
    // Contadores de identidad / serial al día.
    const seqs = await q(`select a.attname, pg_get_serial_sequence($1, a.attname) as seq from pg_attribute a where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped`, [t]);
    for (const s of seqs.rows) {
      if (!s.seq) continue;
      await q(`select setval($1, coalesce((select max("${String(s.attname)}") from ${ident(t)}), 0) + 1, false)`, [s.seq]);
    }
  }
  return { tables: order.length, rows };
}
