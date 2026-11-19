/**
 * Asistente del despacho: reconoce qué se le pregunta (sin inteligencia artificial ni servicios
 * externos: los datos de los clientes no salen de la aplicación). Solo interpreta el texto; las
 * respuestas se buscan en la base de datos respetando los permisos (ver assistant.ts).
 */
export type Intent =
  | { kind: "ayuda" }
  | { kind: "resumen" }
  | { kind: "expediente"; ref: string }
  | { kind: "cliente"; query: string }
  | { kind: "facturas_pendientes"; client: string | null }
  | { kind: "facturas_vencidas" }
  | { kind: "plazos"; days: number }
  | { kind: "expedientes_activos" }
  | { kind: "buscar"; query: string };

/** Minúsculas y sin tildes, para comparar sin depender de cómo se escriba. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "de del la el los las un una unos unas que cual cuales cuanto cuanta cuantos cuantas como esta estan es son hay me mi mis dame dime muestra muestrame ver quiero saber sobre para por con a al y o en su sus le les lo informacion info datos estado situacion cliente clientes expediente expedientes caso casos factura facturas debe deben pendiente pendientes cobrar cobro"
    .split(" "),
);

/** Lo que queda de una frase al quitar las palabras de la pregunta: el nombre buscado. */
export function subject(text: string, extraStop: string[] = []): string {
  const extra = new Set(extraStop);
  return normalize(text)
    .split(" ")
    .filter((w) => w && !STOP.has(w) && !extra.has(w))
    .join(" ")
    .trim();
}

export function parseIntent(raw: string): Intent {
  const text = raw.slice(0, 300);
  const n = normalize(text);
  if (!n || /^(hola|buenas|ayuda|help|que puedes hacer|que sabes hacer|menu|opciones)\b/.test(n)) return { kind: "ayuda" };

  // Número de expediente (EXP-2026-0001, exp 2026-1, 2026-0001)
  const exp = /\bexp(?:ediente)?[\s-]*(\d{4})[\s-]*(\d{1,4})\b/.exec(n) ?? /\b(20\d{2})-(\d{1,4})\b/.exec(n);
  if (exp) return { kind: "expediente", ref: `EXP-${exp[1]}-${exp[2].padStart(4, "0")}` };

  if (/\b(resumen|como vamos|como va todo|estado general|panorama)\b/.test(n)) return { kind: "resumen" };

  if (/\b(plazo|plazos|vencimiento|vencimientos|audiencia|audiencias|agenda|proxim[oa]s? (dias|eventos)|esta semana|hoy|manana)\b/.test(n)) {
    const days = /\bhoy\b/.test(n) ? 1 : /\bmanana\b/.test(n) ? 2 : /\bmes\b/.test(n) ? 31 : 7;
    return { kind: "plazos", days };
  }

  if (/\bfacturas?\b|\bcobr|\bdeb[eo]n?\b|\bpendiente de pago\b|\bsaldo\b/.test(n)) {
    if (/\bvencid/.test(n) && !/\bde\s+\w/.test(n.replace(/vencidas?/, ""))) return { kind: "facturas_vencidas" };
    const who = subject(text, ["vencida", "vencidas", "emitida", "emitidas", "sin", "pagar", "pagada", "pagadas", "saldo", "tiene", "tienen", "todas", "todos", "cuanto", "nos"]);
    return { kind: "facturas_pendientes", client: who || null };
  }

  if (/\bexpedientes? (activos|abiertos|en curso)\b|\bcuantos expedientes\b|\bmis expedientes\b|\bexpedientes\b$/.test(n)) return { kind: "expedientes_activos" };

  if (/\bclientes?\b/.test(n)) {
    const who = subject(text, ["tiene", "tienen"]);
    if (who) return { kind: "cliente", query: who };
  }
  if (/\b(expediente|caso)\b/.test(n)) {
    const what = subject(text);
    if (what) return { kind: "expediente", ref: what };
    return { kind: "expedientes_activos" };
  }

  const q = subject(text);
  return q ? { kind: "buscar", query: q } : { kind: "ayuda" };
}
