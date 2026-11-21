/**
 * «Razonamiento» del asistente sin IA externa: entender la pregunta (sinónimos y tipo de trámite),
 * sacar datos (fechas, cantidades, salario, antigüedad) y escoger el fragmento que responde.
 * Todo es puro y determinista (se prueba en tests/assistant-reason.test.ts).
 */
import { normalize } from "./assistant-intent";

/** Formas de preguntar → términos que aparecen en las leyes y en la base de conocimiento. */
const SYNONYMS: [RegExp, string][] = [
  [/\bapel(ar|o|e|amos|aron)\b/, "apelación"],
  [/\brecurr(ir|o|e|amos)\b|\bimpugn(ar|o)\b/, "recurso impugnación"],
  [/\bdespid(ieron|io|ido|ir|e)\b|\bme corrieron\b|\bliquidaron\b/, "despido cesantía preaviso"],
  [/\bliquidacion\b|\bprestaciones\b/, "preaviso cesantía vacaciones aguinaldo"],
  [/\brenunci(ar|o|e|a)\b/, "renuncia preaviso"],
  [/\bcobr(ar|o|e)\b|\bme deben\b|\bdeuda\b|\bpagare\b|\bletra de cambio\b|\bcheque\b/, "cobro monitorio obligaciones dinerarias"],
  [/\bdesalo(jo|jar)\b|\binquilino\b|\balquiler\b/, "desahucio arrendamiento"],
  [/\bcontest(ar|o|e)\b/, "contestar contestación"],
  [/\bcuanto tiempo\b|\bhasta cuando\b|\bque plazo\b|\bplazo para\b|\btermino para\b/, "plazo"],
  [/\bvacacion(es)?\b/, "vacaciones"],
  [/\baguinaldo\b|\bdecimo tercer\b/, "aguinaldo"],
  [/\bprescrib(e|ir|io)\b|\bprescripcion\b|\bse vence el derecho\b/, "prescripción"],
  [/\bferiado(s)?\b|\bdia libre\b|\basueto\b/, "feriados"],
  [/\bindice(s)?\b|\bindex\b/, "índice notarial"],
];

export function expandQuery(question: string): string {
  const n = normalize(question);
  const extra = SYNONYMS.filter(([re]) => re.test(n)).map(([, t]) => t);
  return [question, ...extra].join(" ");
}

/** Plazos procesales frecuentes, para responder «¿cuánto tengo para…?» y calcular la fecha. */
/** Materia penal: la pregunta menciona el proceso penal (los plazos son otros que en el civil). */
const PENAL = String.raw`(penal\w*|delito|imputad\w*|fiscal\w*|querell\w*|acusad\w*|tribunal de juicio)`;
/** El patrón y, en cualquier lugar de la pregunta, una palabra del proceso penal. */
const both = (a: string) => new RegExp(String.raw`^(?=.*\b${PENAL}\b).*\b${a}\b`);

export const PROCEDURAL_DEADLINES = [
  // Proceso penal (CPP): los plazos por días cuentan solo días hábiles, desde el día siguiente a la notificación (art. 167).
  { key: "casacion_penal", match: both("casacion"), days: 15, label: "recurso de casación penal", ref: "CPP art. 469" },
  { key: "apelacion_sentencia_penal", match: both(String.raw`(apela\w*\b.*\bsentencia|sentencia\b.*\bapela\w*)`), days: 15, label: "apelar una sentencia penal", ref: "CPP art. 460" },
  { key: "apelacion_auto_penal", match: both(String.raw`apela\w*`), days: 3, label: "apelar una resolución penal dictada por escrito (si se dictó en audiencia, se apela en la misma audiencia)", ref: "CPP art. 453" },
  { key: "revocatoria_penal", match: both(String.raw`(revocatoria|revocar)`), days: 3, label: "recurso de revocatoria en materia penal", ref: "CPP art. 450" },
  { key: "casacion", match: /\bcasacion\b/, days: 15, label: "recurso de casación", ref: "CPC art. 69.3" },
  { key: "apelacion_sentencia", match: /\bapela\w*\b.*\bsentencia\b|\bsentencia\b.*\bapela\w*\b/, days: 5, label: "apelar una sentencia", ref: "CPC art. 67" },
  { key: "apelacion_auto", match: /\bapela\w*\b/, days: 3, label: "apelar un auto", ref: "CPC art. 67" },
  { key: "revocatoria", match: /\brevocatoria\b|\brevocar\b/, days: 3, label: "recurso de revocatoria (auto escrito)", ref: "CPC art. 66.1" },
  { key: "monitorio", match: /\bmonitorio\b|\bintimatoria\b|\boponer\w*\b.*\bcobro\b/, days: 5, label: "cumplir u oponerse en el monitorio", ref: "CPC art. 110.2" },
  { key: "sumario", match: /\bsumario\b/, days: 5, label: "contestar en el proceso sumario", ref: "CPC art. 103.2" },
  { key: "ordinario", match: /\bcontest\w*\b/, days: 30, label: "contestar en el proceso ordinario", ref: "CPC art. 102.1" },
] as const;

export function detectProcedure(question: string) {
  const n = normalize(question);
  return PROCEDURAL_DEADLINES.find((p) => p.match.test(n)) ?? null;
}

/** Fecha mencionada: «20/11», «20/11/2026», «2026-11-20», «hoy», «ayer». */
export function extractDate(question: string, today: string): string | null {
  const n = normalize(question);
  if (/\bhoy\b/.test(n)) return today;
  if (/\bayer\b/.test(n)) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  const isoM = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(question);
  if (isoM) return `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
  const dm = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(question);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    let year = dm[3] ? Number(dm[3]) : Number(today.slice(0, 4));
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/** «plazo de 5 días», «3 meses», «un año». */
export function extractDuration(question: string): { amount: number; unit: "dias" | "meses" | "anos" } | null {
  const n = normalize(question).replace(/\bun\b|\buna\b/g, "1");
  const m = /\b(\d{1,3})\s*(dias?|meses|mes|anos?)\b/.exec(n);
  if (!m) return null;
  const unit = m[2].startsWith("dia") ? "dias" : m[2].startsWith("mes") ? "meses" : "anos";
  return { amount: Number(m[1]), unit };
}

/** Antigüedad y salario para la liquidación: «3 años y 7 meses», «salario de 600 000», «gana ₡450.000». */
export function extractSettlement(question: string): { years: number; months: number; salary: number | null; justCause: boolean } | null {
  const n = normalize(question);
  const y = /\b(\d{1,2})\s*anos?\b/.exec(n);
  const mo = /\b(\d{1,2})\s*mes(es)?\b/.exec(n);
  if (!y && !mo) return null;
  // El salario: el número grande (≥ 10 000) que aparezca, aceptando separadores de miles.
  const nums = [...question.matchAll(/(\d{1,3}(?:[ . ,]\d{3})+|\d{5,})(?:[.,]\d{1,2})?/g)].map((m) => Number(m[1].replace(/[ . ,]/g, "")));
  const salary = nums.filter((v) => v >= 10_000).sort((a, b) => b - a)[0] ?? null;
  const justCause = /\brenunci|\bjusta causa\b|\bcon causa\b/.test(n) && !/\bsin justa causa\b|\bsin causa\b/.test(n);
  return { years: y ? Number(y[1]) : 0, months: mo ? Number(mo[1]) : 0, salary, justCause };
}

/** Raíz aproximada en español (para comparar «apelar» con «apelación», «plazos» con «plazo»). */
export function stem(word: string): string {
  const w = normalize(word);
  for (const suf of ["aciones", "amiento", "imiento", "acion", "iones", "mente", "ion", "ando", "iendo", "ados", "idos", "adas", "idas", "ado", "ido", "ada", "ida", "ar", "er", "ir", "es", "os", "as", "a", "o", "e", "s"]) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) return w.slice(0, -suf.length);
  }
  return w;
}

const STOPWORDS = new Set(
  "el la los las un una unos unas de del al a en y o u que para por con sin se su sus lo le les me mi mis tu te es son fue ser hay como cual cuales cuanto cuanta cuantos cuantas cuando donde quien que esto esta este estos estas ese esa eso muy mas menos ya no si tengo tiene tienen puedo puede debo debe hacer hace dice segun sobre entre".split(" "),
);

export function keywords(text: string): string[] {
  return [...new Set(normalize(text).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)).map(stem))];
}

/**
 * El párrafo (o línea de lista) que mejor responde: el que comparte más raíces con la pregunta.
 * Si nada destaca, el comienzo del texto.
 */
export function bestPassage(body: string, question: string, maxLength = 700): string {
  const q = new Set(keywords(question));
  const parts = body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  let best = { score: 0, i: 0 };
  parts.forEach((p, i) => {
    const score = keywords(p).filter((k) => q.has(k)).length;
    if (score > best.score) best = { score, i };
  });
  // El párrafo elegido y, si es una línea de lista, su encabezado (la línea anterior que termina en «:»).
  let out = parts[best.i] ?? body;
  if (best.score > 0 && best.i > 0 && /^[-•\d]/.test(out) && /:$/.test(parts[best.i - 1])) out = `${parts[best.i - 1]}\n${out}`;
  if (best.score === 0) out = parts.slice(0, 2).join("\n");
  return out.length > maxLength ? `${out.slice(0, maxLength).replace(/\s+\S*$/, "")}…` : out;
}
