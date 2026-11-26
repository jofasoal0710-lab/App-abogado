/**
 * Análisis de una demanda recibida, sin inteligencia artificial y sin enviar nada fuera: a partir del texto
 * se reconocen las partes del escrito que exige la ley (CPC art. 35.1: hechos numerados, pretensiones,
 * fundamento jurídico, prueba, estimación), el tipo de proceso, el plazo para contestar, las partes, los
 * montos, las fechas y las leyes citadas. Lógica pura: lo usan la pantalla, la generación del escrito y los tests.
 *
 * Es una lectura por reglas: funciona con demandas que siguen la estructura habitual. Todo lo que se detecta
 * se muestra para que el abogado o la abogada lo revise y lo corrija.
 */
import { articleNumbersFrom } from "./law-parser";

/* ---------------- Tipos ---------------- */

export type ProcessKind = "ordinario_civil" | "sumario_civil" | "monitorio" | "laboral" | "familia" | "contencioso";

export type ProcessInfo = {
  label: string;
  /** Plazo para contestar, en días hábiles, y la norma (verificada en el texto cargado en la app). */
  days: number;
  ref: string;
  /** Qué exige la contestación y qué pasa si no se responden los hechos. */
  rule: string;
  area: "civil" | "laboral" | "familia" | "administrativo";
};

/** Plazos y reglas de la contestación, citados de los textos de SINALEVI cargados en la app. */
export const PROCESSES: Record<ProcessKind, ProcessInfo> = {
  ordinario_civil: {
    label: "Proceso ordinario civil",
    days: 30,
    ref: "CPC art. 102.1",
    rule: "Hay que contestar todos los hechos en el orden de la demanda: rechazarlos por inexactos, admitirlos como ciertos, con variantes o rectificaciones, o desconocerlos. Los hechos sin respuesta pueden tenerse por admitidos (CPC art. 37.1). Las excepciones van con la contestación, razonadas (art. 37.2).",
    area: "civil",
  },
  sumario_civil: {
    label: "Proceso sumario civil",
    days: 5,
    ref: "CPC art. 103.2",
    rule: "Se contesta en cinco días, con los mismos requisitos de la contestación (CPC art. 37.1: responder hecho por hecho; sin respuesta, pueden tenerse por admitidos).",
    area: "civil",
  },
  monitorio: {
    label: "Proceso monitorio",
    days: 5,
    ref: "CPC art. 110.2",
    rule: "En el monitorio no se «contesta»: en cinco días se paga o se presenta oposición fundada (CPC art. 110.2).",
    area: "civil",
  },
  laboral: {
    label: "Proceso ordinario laboral",
    days: 10,
    ref: "Código de Trabajo art. 497",
    rule: "Diez días para contestar, exponiendo con claridad si se rechazan los hechos o si se admiten con variantes o rectificaciones (CT art. 497). Los hechos no contestados se tienen por ciertos (art. 498) y puede dictarse sentencia anticipada (art. 506). Todas las defensas formales y de fondo van en la contestación (art. 500).",
    area: "laboral",
  },
  familia: {
    label: "Proceso resolutivo familiar",
    days: 8,
    ref: "CPF art. 223",
    rule: "Ocho días hábiles para contestar por escrito con los requisitos del art. 221 CPF. Si no se contestan los hechos en la forma debida, se previene corregir en tres días; si no, se tienen por no contestados (CPF art. 223).",
    area: "familia",
  },
  contencioso: {
    label: "Proceso contencioso-administrativo",
    days: 30,
    ref: "CPCA art. 63",
    rule: "Treinta días hábiles para contestar (quince si el actor aportó copia certificada del expediente administrativo), CPCA art. 63.",
    area: "administrativo",
  },
};

export type Item = { n: number; text: string };
export type Amount = { text: string; value: number; currency: "CRC" | "USD" };
export type Citation = { raw: string; normKey: string | null; law: string; articles: string[] };
export type EvidenceKind = "documental" | "testimonial" | "declaracion_parte" | "pericial" | "reconocimiento" | "informes" | "otra";

export type DemandAnalysis = {
  process: ProcessKind;
  /** Por qué se eligió ese tipo de proceso (palabras encontradas), para que se pueda corregir. */
  processWhy: string;
  court: string | null;
  caseNumber: string | null;
  plaintiffs: string[];
  defendants: string[];
  facts: Item[];
  claims: Item[];
  evidence: (Item & { kind: EvidenceKind })[];
  legalGrounds: string | null;
  estimate: Amount | null;
  claimAmounts: Amount[];
  dates: string[];
  citations: Citation[];
  /** Secciones reconocidas (para mostrar qué se entendió y qué no). */
  sections: string[];
  words: number;
  /** Fecha de la demanda (la del lugar y fecha junto a la firma), si se reconoce. */
  filedOn?: string | null;
  /** Normas procesales que invoca la propia demanda (p. ej. «Ley 7130»), para avisar del régimen aplicable. */
  procedureLaw?: string | null;
};

/* ---------------- Utilidades ---------------- */

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Limpia el texto extraído de un PDF/Word: espacios, guiones de corte de línea, números de página sueltos. */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !/^(p[aá]gina\s*)?\d{1,3}(\s*(de|\/)\s*\d{1,3})?$/i.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------------- Secciones ---------------- */

type SectionKey = "hechos" | "pretensiones" | "fundamentos" | "prueba" | "estimacion" | "notificaciones" | "otra";
const SECTION_RX: [SectionKey, RegExp][] = [
  ["hechos", /^(?:(?:de|sobre)\s+los\s+|relacion\s+de\s+(?:los\s+)?)?hechos?\b/],
  ["pretensiones", /^(?:pretensi(?:on|ones)(?:\s+materiales?)?|petitori[ao]|peticion(?:es)?|solicitud(?:es)?|por\s+tanto|lo\s+que\s+(?:se\s+)?(?:pide|solicita))\b/],
  ["fundamentos", /^(?:fundamentos?|fundamentacion)\s+(?:de\s+derecho|juridicos?|legal(?:es)?)\b|^derecho\b|^fundamento\s+juridico\b/],
  ["prueba", /^(?:ofrecimiento\s+de\s+(?:la\s+)?prueba|medios?\s+de\s+prueba|pruebas?|prueba\s+(?:ofrecida|documental))\b/],
  ["estimacion", /^(?:estimacion|cuantia)\b/],
  ["notificaciones", /^(?:notificaciones|medio\s+para\s+(?:recibir\s+)?notificaciones|lugar\s+para\s+notificaciones)\b/],
  ["otra", /^(?:personeria|medidas?\s+cautelar(?:es)?|excepciones?|anexos?|costas|competencia|calidades|cuestion\s+previa|naturaleza\s+del\s+proceso|tramite)\b/],
];

/** «III.- HECHOS:» → «hechos». Solo líneas cortas con aspecto de título (mayúsculas o terminadas en «:»). */
export function headingOf(line: string): SectionKey | null {
  const l = line.trim();
  if (!l || l.length > 70) return null;
  const letters = l.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length / Math.max(letters.length, 1);
  if (upper < 0.6 && !/:\s*$/.test(l)) return null;
  const body = fold(l)
    .replace(/^(?:[ivxlc]+|\d+|[a-h])\s*[.)\-–:]+\s*-?\s*/, "")
    .replace(/[:.\-–\s]+$/, "")
    .trim();
  if (body.split(/\s+/).length > 7) return null;
  for (const [k, rx] of SECTION_RX) if (rx.test(body)) return k;
  return null;
}

function splitSections(text: string): Map<SectionKey, string> {
  const out = new Map<SectionKey, string>();
  let current: SectionKey | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current && current !== "otra") out.set(current, [out.get(current), buf.join("\n")].filter(Boolean).join("\n").trim());
    buf = [];
  };
  for (const line of text.split("\n")) {
    const h = headingOf(line);
    if (h) {
      flush();
      current = h;
      // «HECHOS: Primero. …» en la misma línea: lo que sigue al título es contenido.
      const rest = line.replace(/^[^:]*:\s*/, "");
      if (rest !== line && rest.trim()) buf.push(rest);
      continue;
    }
    if (current) buf.push(line);
  }
  flush();
  return out;
}

/* ---------------- Enumeraciones (PRIMERO., 1.-, a)…) ---------------- */

const ORDINAL_WORDS = [
  "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "septimo|setimo", "octavo", "noveno", "decimo",
  "undecimo|decimo\\s*primero", "duodecimo|decimo\\s*segundo", "decimo\\s*tercero", "decimo\\s*cuarto", "decimo\\s*quinto",
  "decimo\\s*sexto", "decimo\\s*(?:septimo|setimo)", "decimo\\s*octavo", "decimo\\s*noveno", "vigesimo",
];
const ORD_ALT = ORDINAL_WORDS.join("|");
/** Marca de inicio de un punto: «PRIMERO.», «Hecho segundo:», «1.-», «2)», «III.», «a)». */
const MARKER = new RegExp(String.raw`^(?:hecho\s+|pretension\s+|prueba\s+)?(?:(?:${ORD_ALT})(?:\s*[a-z]?\b)?\s*[.:)\-–]+|\d{1,2}\s*(?:[.)\-–]+|\.-)(?!\d)|[ivxlc]{1,6}\s*[.)\-–]+|[a-h]\))\s*`, "i");

/** Divide el texto de una sección en puntos numerados; sin numeración, por párrafos. */
export function splitItems(section: string): string[] {
  const lines = section.split("\n");
  const items: string[] = [];
  let cur: string[] | null = null;
  let marked = 0;
  let preamble = false;
  for (const line of lines) {
    const f = fold(line);
    const m = MARKER.exec(f);
    if (m) marked++;
    if (m && line.trim().length > m[0].length) {
      if (cur) items.push(cur.join(" "));
      cur = [line.slice(m[0].length).trim()];
    } else if (m && !line.trim().slice(m[0].length)) {
      if (cur) items.push(cur.join(" "));
      cur = [];
    } else if (cur) {
      cur.push(line);
    } else if (line.trim()) {
      cur = [line];
      // Texto sin numerar antes del primer punto («En mérito de lo expuesto… solicito:»): es una introducción.
      preamble = /:\s*$/.test(line.trim()) || /^(?:en\s+merito|por\s+tanto|con\s+fundamento|por\s+lo\s+expuesto|de\s+conformidad|solicito|pido|ofrezco)\b/.test(f.trim());
    }
  }
  if (cur) items.push(cur.join(" "));
  if (preamble && marked >= 2) items.shift();
  const clean = items.map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 2);
  if (clean.length >= 2) return clean;
  // Sin marcas: un punto por párrafo.
  return section
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 15);
}

/* ---------------- Tipo de proceso ---------------- */

export function detectProcess(text: string): { kind: ProcessKind; why: string } {
  const head = fold(text.slice(0, 4000));
  const all = fold(text);
  const hit = (rx: RegExp, where = head) => rx.exec(where)?.[0];
  let w: string | undefined;
  if ((w = hit(/\bmonitori[oa]\b/))) return { kind: "monitorio", why: w };
  if ((w = hit(/contencioso[\s-]*administrativ\w*|\bcpca\b/))) return { kind: "contencioso", why: w };
  if ((w = hit(/\b(?:proceso|demanda)\s+(?:ordinari[oa]\s+)?laboral\b|\bjuzgado\s+de\s+trabajo\b|\bmateria\s+laboral\b/))) return { kind: "laboral", why: w };
  if ((w = hit(/\b(?:divorcio|separacion judicial|pension(?:es)? alimentari\w*|filiacion|guarda,? crianza|regimen de (?:visitas|interrelacion)|resolutivo familiar|juzgado de familia|union de hecho)\b/))) return { kind: "familia", why: w };
  if ((w = hit(/\b(?:sumari[oa]|desahucio|interdicto|interdictal)\b/))) return { kind: "sumario_civil", why: w };
  // Pistas en todo el texto, más débiles.
  const laborCount = (all.match(/\b(?:patrono|patronal|trabajador\w*|despid\w*|salario\w*|preaviso|cesantia|aguinaldo|codigo de trabajo)\b/g) ?? []).length;
  if (laborCount >= 4) return { kind: "laboral", why: `${laborCount} términos laborales (patrono, salario, despido…)` };
  return { kind: "ordinario_civil", why: hit(/\b(?:proceso\s+)?ordinari[oa]\b/) ?? "por defecto (no se indicó otro tipo de proceso)" };
}

/* ---------------- Partes, juzgado, expediente ---------------- */

const NAME_STOP = /,|\n|\s+(?:mayor|menor|casad[oa]|solter[oa]|divorciad[oa]|viud[oa]|vecin[oa]|portador|cedula|con\s+cedula|persona|sociedad\s+an[oó]nima\s+con|en\s+su\s+condici[oó]n|representad[oa]|domiciliad[oa]|quien|por\s+los\s+siguientes|a\s+fin)\b/i;
const cutName = (s: string) => {
  let n = s.split(NAME_STOP)[0].replace(/^[\s:,"«]+|[\s:,"»]+$/g, "").replace(/\s+/g, " ").trim();
  // «S.A.», «S.R.L.»: el punto final es parte de la abreviatura; si no, se quita.
  if (/(?:\b[A-Z]\.)+[A-Z]?\.?$/.test(n)) n = n.endsWith(".") ? n : `${n}.`;
  else n = n.replace(/\.+$/, "");
  return n;
};
const isName = (s: string) => s.length >= 4 && s.length <= 120 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}/.test(s) && !/^(el|la|los|las|mi|su)\s/i.test(s);

export function detectParties(text: string): { plaintiffs: string[]; defendants: string[] } {
  // Se conservan los saltos de línea: «ACTOR: …» y «DEMANDADA: …» suelen ir en líneas seguidas.
  const head = text.slice(0, 5000).replace(/[ \t]+/g, " ");
  const plaintiffs: string[] = [];
  const defendants: string[] = [];
  const add = (set: string[], raw: string | undefined) => {
    if (!raw) return;
    for (const part of raw.split(/\s+y\s+(?=[A-ZÁÉÍÓÚÑ])/)) {
      const n = cutName(part.replace(/\s+/g, " "));
      if (!isName(n)) continue;
      // La misma persona en mayúsculas y en minúsculas: se queda la forma con minúsculas (más legible).
      const i = set.findIndex((x) => fold(x) === fold(n));
      if (i < 0) set.push(n);
      else if (set[i] === set[i].toUpperCase() && n !== n.toUpperCase()) set[i] = n;
    }
  };
  // «Quien suscribe, NOMBRE, mayor…» / «Yo, NOMBRE, …»
  add(plaintiffs, /(?:quien(?:es)?\s+suscrib\w+|(?:el|la|los|las)\s+suscrit[oa]s?|yo)\s*,?\s*([A-ZÁÉÍÓÚÑ][^,]{3,120})/i.exec(head)?.[1]);
  for (const m of head.matchAll(/(?:parte\s+)?(?:actor|actora|demandante|accionante)\s*[:]\s*([A-ZÁÉÍÓÚÑ][^,;\n]{3,120})/gi)) add(plaintiffs, m[1]);
  // «… en contra de NOMBRE, …» / «contra NOMBRE»
  add(defendants, /\b(?:en\s+)?contra\s+(?:de\s+)?(?:la\s+(?:empresa|sociedad)\s+|el\s+señor\s+|la\s+señora\s+)?([A-ZÁÉÍÓÚÑ][^,;]{2,120})/.exec(head)?.[1]);
  for (const m of head.matchAll(/(?:parte\s+)?(?:demandad[oa]|accionad[oa])\s*[:]\s*([A-ZÁÉÍÓÚÑ][^,;\n]{3,120})/gi)) add(defendants, m[1]);
  return { plaintiffs: plaintiffs.slice(0, 6), defendants: defendants.slice(0, 6) };
}

export function detectCourt(text: string): string | null {
  for (const line of text.split("\n").slice(0, 40)) {
    const m = /\b(juzgado|tribunal|sala)\b.{3,140}/i.exec(line);
    if (m) return m[0].replace(/^(señor(?:\(a\))?|señora|sr\.?|sra\.?)\s+(juez|jueza|juez\(a\))\s+(del?\s+)?/i, "").replace(/[.:,\s]+$/, "").trim();
  }
  return null;
}

const CASE_RX = /\b\d{2}-\d{6}-\d{4}-[A-Z]{2}\b/;
/**
 * Número del expediente de ESTA demanda: el del encabezado («EXP.: 24-000123-0123-FA»). Si el encabezado dice
 * «por asignar», no hay número todavía (los que aparecen en los hechos son de otros procesos). Sin encabezado,
 * se toma el primero que aparezca al principio del escrito.
 */
export function detectCaseNumber(text: string): string | null {
  const headLines = text.split("\n").slice(0, 20);
  for (const line of headLines) {
    const m = /^\s*(?:exp(?:ediente)?|n[º°.o]*\s*de\s+expediente)\b[^:]{0,20}:?\s*(.*)$/i.exec(line);
    if (!m) continue;
    const num = CASE_RX.exec(m[1]);
    if (num) return num[0];
    if (/por\s+asignar|pendiente|sin\s+asignar|nuevo/i.test(m[1])) return null;
  }
  return CASE_RX.exec(text.slice(0, 1500))?.[0] ?? null;
}

/* ---------------- Montos y fechas ---------------- */

/** «₡1.250.000,00» → 1250000; «$3,500.50» → 3500.5. Admite formato costarricense y anglosajón. */
export function parseMoney(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, "").replace(/[.,]+$/, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const decSep = lastComma > lastDot && s.length - lastComma <= 3 ? "," : lastDot > lastComma && s.length - lastDot <= 3 && (s.match(/\./g) ?? []).length === 1 && lastComma !== -1 ? "." : s.length - lastComma === 3 && lastComma > lastDot ? "," : null;
  if (decSep === ",") s = s.replace(/\./g, "").replace(",", ".");
  else if (decSep === ".") s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const MONEY_RX = /(?:₡|¢|CRC\s?|colones\s+)\s?[\d][\d.,]*|(?:US\$|\$|USD\s?)\s?[\d][\d.,]*|[\d][\d.,]*\s*(?:colones|d[oó]lares)/gi;
export function findAmounts(text: string): Amount[] {
  const out: Amount[] = [];
  for (const m of text.matchAll(MONEY_RX)) {
    const value = parseMoney(m[0]);
    if (value === null || value < 1000 && !/[$]/.test(m[0])) continue;
    out.push({ text: m[0].trim(), value, currency: /\$|usd|d[oó]lar/i.test(m[0]) ? "USD" : "CRC" });
  }
  return out;
}

const MONTHS: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
/** Fechas mencionadas («5 de marzo de 2024», «05/03/2024»), en ISO y ordenadas. */
export function findDates(text: string): string[] {
  const out = new Set<string>();
  const ok = (y: number, m: number, d: number) => y >= 1950 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  for (const m of fold(text).matchAll(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del\s+)?(\d{4})\b/g)) {
    const [d, mo, y] = [Number(m[1]), MONTHS[m[2]], Number(m[3])];
    if (ok(y, mo, d)) out.add(iso(y, mo, d));
  }
  for (const m of text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g)) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (ok(y, mo, d)) out.add(iso(y, mo, d));
  }
  return [...out].sort();
}

/* ---------------- Leyes citadas ---------------- */

const LAWS: [RegExp, string, string][] = [
  [/codigo\s+procesal\s+civil|\bcpc\b/, "ley-9342", "Código Procesal Civil"],
  [/codigo\s+procesal\s+de\s+familia|\bcpf\b/, "ley-9747", "Código Procesal de Familia"],
  [/codigo\s+procesal\s+contencioso|\bcpca\b/, "ley-8508", "Código Procesal Contencioso-Administrativo"],
  [/codigo\s+procesal\s+penal|\bcpp\b/, "ley-7594", "Código Procesal Penal"],
  [/codigo\s+de\s+trabajo|\bc\.?\s?t\.?\b/, "ley-2", "Código de Trabajo"],
  [/codigo\s+de\s+familia/, "ley-5476", "Código de Familia"],
  [/codigo\s+de\s+comercio/, "ley-3284", "Código de Comercio"],
  [/codigo\s+penal/, "ley-4573", "Código Penal"],
  [/codigo\s+civil/, "ley-63", "Código Civil"],
  [/constitucion\s+politica|\bconstitucion\b/, "constitucion", "Constitución Política"],
  [/ley\s+general\s+de\s+arrendamientos|ley\s+de\s+arrendamientos/, "ley-7527", "Ley General de Arrendamientos Urbanos y Suburbanos"],
  [/ley\s+general\s+de\s+(?:la\s+)?administracion\s+publica|\blgap\b/, "ley-6227", "Ley General de la Administración Pública"],
  [/ley\s+(?:de\s+)?(?:promocion\s+de\s+la\s+competencia|del?\s+consumidor)/, "ley-7472", "Ley de Promoción de la Competencia y Defensa Efectiva del Consumidor"],
  [/ley\s+contra\s+la\s+violencia\s+domestica/, "ley-7586", "Ley contra la Violencia Doméstica"],
  [/ley\s+de\s+notificaciones/, "ley-8687", "Ley de Notificaciones Judiciales"],
];

/** «artículos 28, 29 y 30 del Código de Trabajo», «art. 45 CPC», «numeral 1045 del Código Civil». */
export function findCitations(text: string): Citation[] {
  const f = fold(text).replace(/\s+/g, " ").replace(/\bn\s*[.]?\s*[º°o]?\s*[.]?\s*(?=\d)/g, "n ");
  const out = new Map<string, Citation>();
  // Cada número puede llevar «inciso 8) “segundo”» o «párrafo primero», que no son artículos.
  const NUM = String.raw`\d+(?:\s*(?:bis|ter))?(?:\.\d+)?(?:\s+inciso\s+\w+\)?(?:\s*[“"«][^”"»]{1,15}[”"»])?|\s+parrafo\s+\w+)?`;
  const rx = new RegExp(String.raw`\b(?:art(?:iculos?|s?\.)|numeral(?:es)?|ordinal(?:es)?)\s*((?:${NUM}|[ivx]+)(?:\s*(?:,|y|e|al|a|-)\s*(?:${NUM}))*)(?:\s+y\s+siguientes)?\s*(?:,\s*)?(?:del?\s+(?:la\s+|el\s+)?)?((?:codigo|constitucion|ley|cpc|cpf|cpca|cpp|lgap|c\.?\s?t\.?\b)(?:(?!\s(?:y|e)\s|,\s*(?:art|num)|\sart)[^.;:()]){0,80})?`, "g");
  for (const m of f.matchAll(rx)) {
    const spec = m[1].replace(/\s+inciso\s+\w+\)?(?:\s*[“"«][^”"»]{1,15}[”"»])?|\s+parrafo\s+\w+/g, "").replace(/\.\d+/g, "");
    const lawText = m[2] ?? "";
    let normKey: string | null = null;
    let law = "";
    for (const [lrx, key, name] of LAWS) {
      if (lrx.test(lawText)) {
        normKey = key;
        law = name;
        break;
      }
    }
    // «Código Procesal Civil, Ley 7130»: el número de ley manda (es el código anterior, no el vigente).
    const explicit = /\bley\s+(?:n\s*)?(\d{1,5})\b/.exec(lawText)?.[1];
    if (normKey && explicit && normKey !== `ley-${explicit}` && /^ley-/.test(normKey)) {
      normKey = `ley-${explicit}`;
      law = `${law} (Ley N.º ${explicit})`;
    }
    if (!normKey) {
      const num = /\bley\s+(?:n[.ºo°]*\s*)?(\d{1,5})\b/.exec(lawText);
      if (num) {
        normKey = `ley-${num[1]}`;
        law = `Ley N.º ${num[1]}`;
      }
    }
    if (!normKey) continue; // sin ley identificable no se puede comprobar
    const articles = articleNumbersFrom(spec);
    if (!articles.length) continue;
    const prev = out.get(normKey);
    out.set(normKey, { raw: (prev ? prev.raw + "; " : "") + m[0].trim().slice(0, 120), normKey, law, articles: [...new Set([...(prev?.articles ?? []), ...articles])] });
  }
  return [...out.values()];
}

/* ---------------- Prueba ---------------- */

export function evidenceKind(s: string): EvidenceKind {
  const f = fold(s);
  if (/\btestig|\btestimonial/.test(f)) return "testimonial";
  if (/\bperit|\bpericial|\bdictamen/.test(f)) return "pericial";
  if (/declaracion\s+de\s+parte|\bconfesion|interrogatorio/.test(f)) return "declaracion_parte";
  if (/reconocimiento\s+judicial|inspeccion/.test(f)) return "reconocimiento";
  if (/\binforme|\bcertificacion|\bsolicit\w+\s+(?:a|al)\s+(?:la\s+)?(?:ccss|ins|registro|ministerio|banco)/.test(f)) return "informes";
  if (/\bdocument|\bcopia|\bcontrato|\bcarta|\bfactura|\bconstancia|\bcomprobante|\bfotograf|\bcorreo|\bplanilla|\borden|\bcolilla|\bestado de cuenta|\bpagare|\bletra/.test(f)) return "documental";
  return "otra";
}

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  documental: "Documental",
  testimonial: "Testimonial",
  declaracion_parte: "Declaración de parte",
  pericial: "Pericial",
  reconocimiento: "Reconocimiento judicial",
  informes: "Informes y certificaciones",
  otra: "Otra",
};

/* ---------------- Análisis completo ---------------- */

export function analyzeDemand(rawText: string): DemandAnalysis {
  const text = cleanText(rawText);
  const sections = splitSections(text);
  const proc = detectProcess(text);
  const { plaintiffs, defendants } = detectParties(text);
  const facts = splitItems(sections.get("hechos") ?? "").slice(0, 150).map((t, i) => ({ n: i + 1, text: t.slice(0, 6000) }));
  const claims = splitItems(sections.get("pretensiones") ?? "").slice(0, 80).map((t, i) => ({ n: i + 1, text: t.slice(0, 4000) }));
  const evidence = splitEvidence(sections.get("prueba") ?? "").slice(0, 120).map((e, i) => ({ n: i + 1, text: e.text.slice(0, 3000), kind: e.kind }));
  const estimateText = sections.get("estimacion") ?? /estim[oa]\w*[^.]{0,160}/i.exec(text)?.[0] ?? "";
  const estimate = findAmounts(estimateText)[0] ?? null;
  return {
    process: proc.kind,
    processWhy: proc.why,
    court: detectCourt(text),
    caseNumber: detectCaseNumber(text),
    plaintiffs,
    defendants,
    facts,
    claims,
    evidence,
    legalGrounds: sections.get("fundamentos")?.slice(0, 20000) ?? null,
    estimate,
    claimAmounts: findAmounts(sections.get("pretensiones") ?? ""),
    dates: findDates(sections.get("hechos") ?? text),
    citations: findCitations(text),
    sections: [...sections.keys()],
    words: text.split(/\s+/).filter(Boolean).length,
    filedOn: detectFiledOn(text),
    procedureLaw: detectProcedureLaw(text),
  };
}

/** «Cañas, 09 de setiembre de 2024.» al final del escrito. */
export function detectFiledOn(text: string): string | null {
  const tail = text.slice(-2500);
  const lines = tail.split("\n").filter((l) => /\b\d{1,2}\s+de\s+[a-záéíóú]+\s+(?:de|del)\s+\d{4}/i.test(l) && l.length < 160);
  const last = lines.at(-1);
  return last ? (findDates(last).at(-1) ?? null) : null;
}

/** La demanda se funda en el Código Procesal Civil anterior (Ley 7130) o en un «proceso abreviado». */
export function detectProcedureLaw(text: string): string | null {
  const f = fold(text);
  if (/\bley\s*(?:n\s*[.º°o]*\s*)?7130\b/.test(f)) return "Código Procesal Civil anterior (Ley N.º 7130)";
  if (/\bproceso\s*:?\s*abreviado\b|\babreviado\s+de\s+divorcio\b/.test(f)) return "proceso abreviado (normas anteriores al Código Procesal de Familia)";
  return null;
}

const EVIDENCE_HEADINGS: [RegExp, EvidenceKind][] = [
  [/^(?:prueba\s+)?testimonial(?:es)?\b|^testigos?\b/, "testimonial"],
  [/^(?:prueba\s+)?documental(?:es)?\b|^documentos?\b/, "documental"],
  [/^(?:prueba\s+de\s+)?declaracion\s+de\s+parte\b|^confesional\b/, "declaracion_parte"],
  [/^(?:prueba\s+)?pericial\b|^peritaje\b/, "pericial"],
  [/^reconocimiento\s+judicial\b|^inspeccion\b/, "reconocimiento"],
  [/^(?:prueba\s+de\s+)?informes?\b/, "informes"],
];

/**
 * Prueba con subapartados («TESTIMONIAL:», «DOCUMENTAL:», «DECLARACIÓN DE PARTE:»): el apartado da el tipo
 * de cada punto, y las frases de introducción («Ofrezco los siguientes documentos:») no son pruebas.
 */
export function splitEvidence(section: string): { text: string; kind: EvidenceKind }[] {
  const groups: { kind: EvidenceKind | null; lines: string[] }[] = [{ kind: null, lines: [] }];
  for (const line of section.split("\n")) {
    const f = fold(line.trim()).replace(/^(?:[a-h]|\d+|[ivx]+)\s*[.)\-–]+\s*/, "");
    const hit = line.trim().length <= 40 ? EVIDENCE_HEADINGS.find(([rx]) => rx.test(f) && /:?\s*$/.test(f) && f.split(/\s+/).length <= 4) : undefined;
    if (hit) {
      groups.push({ kind: hit[1], lines: [] });
      const rest = line.replace(/^[^:]*:\s*/, "");
      if (rest !== line && rest.trim()) groups.at(-1)!.lines.push(rest);
    } else groups.at(-1)!.lines.push(line);
  }
  const out: { text: string; kind: EvidenceKind }[] = [];
  for (const g of groups) {
    const body = g.lines.join("\n").trim();
    if (!body) continue;
    const items = splitItems(body).filter((t) => !/:\s*$/.test(t) || t.length > 160);
    // Sin subapartado, un único punto puede ser la frase de introducción entera: se conserva.
    for (const t of items.length ? items : [body.replace(/\s+/g, " ")]) {
      if (/:\s*$/.test(t) && t.length <= 160) continue;
      out.push({ text: t, kind: g.kind ?? evidenceKind(t) });
    }
  }
  return out;
}

/* ---------------- Observaciones para preparar la contestación ---------------- */

export type Observation = { level: "alerta" | "aviso" | "info"; text: string; ref?: string };

/** ¿Un hecho mezcla varias afirmaciones? (Conviene admitirlo «con variantes» o responder por partes.) */
export function isCompound(fact: string): boolean {
  const sentences = fact.split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ])/).filter((s) => s.trim().length > 25);
  return sentences.length >= 3 || fact.length > 900;
}

const TOPIC_HINTS: [RegExp, string][] = [
  [/\bdespid\w*/, "Despido: el patrono solo puede alegar los hechos indicados en la carta de despido (CT art. 500). Ten a mano la carta y la constancia de entrega."],
  [/\b(?:salario|planilla|horas?\s+extra\w*|jornada)/, "Salarios y jornada: reúne planillas de la CCSS, colillas de pago y controles de asistencia."],
  [/\b(?:vacaciones|aguinaldo|preaviso|cesantia)/, "Derechos laborales: revisa los cálculos con la calculadora de liquidación (Herramientas) antes de admitir o rechazar montos."],
  [/\b(?:contrato|convenio|acuerdo)\b/, "Contrato: compara lo que dice la demanda con el texto firmado; pide el original si solo aportan copia."],
  [/\b(?:pago|abono|deposito|transferencia)\b/, "Pagos: busca comprobantes y estados de cuenta; pueden fundar la excepción de pago."],
  [/\b(?:accidente|lesion|dano|danos|perjuicio)/, "Daños: la demanda debe indicar por separado causa, descripción y estimación de cada daño (CPC art. 35.1, inciso 4)."],
  [/\b(?:arrend\w*|alquiler|inquilin\w*)/, "Arrendamiento: revisa contrato, recibos de alquiler y avisos por escrito (Ley 7527)."],
];

/**
 * Lo que la app «entiende» que hay que vigilar al contestar: tipo de proceso y plazo, hechos compuestos,
 * fechas antiguas (prescripción), estimación frente a lo pedido, citas que no existen, y que nuestro
 * cliente sea realmente la parte demandada.
 */
export function observations(a: DemandAnalysis, ctx: { clientName?: string | null; today: string; missingArticles?: { law: string; articles: string[] }[] }): Observation[] {
  const out: Observation[] = [];
  const p = PROCESSES[a.process];
  out.push({ level: "info", text: `${p.label}: plazo de ${p.days} días hábiles para contestar.`, ref: p.ref });
  if (a.procedureLaw && a.process === "familia") {
    out.push({ level: "aviso", text: `La demanda se plantea conforme al ${a.procedureLaw}${a.filedOn ? ` y está fechada el ${a.filedOn.split("-").reverse().join("/")}` : ""}. Comprueba en la resolución que da traslado qué normas aplica el juzgado y el plazo que concede: puede no ser el de ocho días del Código Procesal de Familia.` });
  }
  if (!a.facts.length) out.push({ level: "alerta", text: "No encontré la sección de HECHOS numerados. Revisa que el documento tenga texto (si es un escaneo, pega el texto) o añade los hechos a mano." });
  else {
    const compound = a.facts.filter((f) => isCompound(f.text)).map((f) => f.n);
    if (compound.length) {
      const one = compound.length === 1;
      out.push({ level: "aviso", text: `${one ? "El hecho" : "Los hechos"} ${compound.join(", ")} ${one ? "mezcla" : "mezclan"} varias afirmaciones: valora ${one ? "admitirlo" : "admitirlos"} «con variantes o rectificaciones» y precisar qué parte es cierta.`, ref: "CPC art. 37.1" });
    }
  }
  if (!a.claims.length) out.push({ level: "aviso", text: "No encontré las PRETENSIONES (petitoria). Hay que manifestar con claridad la posición sobre ellas.", ref: "CPC art. 37.1" });

  if (ctx.clientName && a.plaintiffs.some((n) => sameParty(n, ctx.clientName!))) {
    out.push({ level: "alerta", text: `Tu cliente (${ctx.clientName}) aparece como parte ACTORA, no como demandada. ¿Seguro que es una demanda contra tu cliente?` });
  } else if (ctx.clientName && a.defendants.length && !a.defendants.some((n) => sameParty(n, ctx.clientName!))) {
    out.push({ level: "aviso", text: `No encontré a tu cliente (${ctx.clientName}) entre los demandados detectados (${a.defendants.join("; ")}). Comprueba la legitimación pasiva: si no es la persona correcta, valora la excepción de falta de legitimación.` });
  }

  if (a.dates.length && a.process !== "familia") {
    const oldest = a.dates[0];
    const years = (Date.parse(ctx.today) - Date.parse(oldest)) / (365.25 * 86_400_000);
    if (years >= 1) out.push({ level: "aviso", text: `El hecho más antiguo es del ${oldest.split("-").reverse().join("/")} (hace ${Math.floor(years)} año${Math.floor(years) === 1 ? "" : "s"}). Revisa si algún extremo está prescrito (calculadora de prescripción en Herramientas).` });
  }

  const crcClaims = a.claimAmounts.filter((x) => x.currency === "CRC");
  if (a.estimate && crcClaims.length) {
    const sum = crcClaims.reduce((s, x) => s + x.value, 0);
    if (a.estimate.currency === "CRC" && Math.abs(sum - a.estimate.value) > Math.max(1, a.estimate.value * 0.01) && crcClaims.length > 1) {
      out.push({ level: "aviso", text: `La estimación (${a.estimate.text}) no coincide con la suma de los montos pedidos en las pretensiones (₡${sum.toLocaleString("es-CR")}). La contestación debe fijar posición sobre la estimación.`, ref: "CPC art. 37.1" });
    }
  } else if (!a.estimate && a.process !== "laboral" && a.process !== "familia") {
    out.push({ level: "info", text: "No encontré la estimación de la demanda: revisa si la indicó (CPC art. 35.1)." });
  }

  for (const miss of ctx.missingArticles ?? []) {
    out.push({ level: "alerta", text: `Cita a revisar: no existe en el texto vigente cargado en la app el art. ${miss.articles.join(", ")} del ${miss.law}.` });
  }

  const ftext = fold(a.facts.map((f) => f.text).join(" "));
  for (const [rx, hint] of TOPIC_HINTS) if (rx.test(ftext)) out.push({ level: "info", text: hint });
  const witnesses = a.evidence.filter((e) => e.kind === "testimonial").length;
  if (a.evidence.some((e) => e.kind === "declaracion_parte")) out.push({ level: "info", text: "La parte actora pide la declaración de parte de tu cliente: prepárala con tiempo, hecho por hecho." });
  if (witnesses) out.push({ level: "info", text: `Ofrece ${witnesses} prueba${witnesses === 1 ? "" : "s"} testimonial${witnesses === 1 ? "" : "es"}: puedes pronunciarte sobre su pertinencia y ofrecer tus propios testigos.` });
  return out;
}

/** ¿Es la misma persona/empresa? Todas las palabras significativas del nombre más corto están en el otro. */
export function sameParty(a: string, b: string): boolean {
  const words = (s: string) => fold(s).replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !["del", "las", "los", "sociedad", "anonima", "limitada", "ltda", "srl"].includes(w));
  const [x, y] = [words(a), words(b)];
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, new Set(y)] : [y, new Set(x)];
  return short.every((w) => long.has(w));
}

/* ---------------- Respuestas y excepciones ---------------- */

export type FactAnswer = "admito" | "variantes" | "rechazo" | "desconozco" | "no_hecho";
export const FACT_ANSWERS: Record<FactAnswer, string> = {
  admito: "Lo admito como cierto",
  variantes: "Lo admito con variantes o rectificaciones",
  rechazo: "Lo rechazo por inexacto",
  desconozco: "Lo desconozco",
  no_hecho: "No es un hecho, sino una apreciación jurídica",
};

export type Defense = { key: string; label: string; kind: "procesal" | "material"; ref: string; hint: string };

/** Excepciones según el proceso. Las procesales civiles son solo las del CPC art. 37.3. */
export function defensesFor(kind: ProcessKind): Defense[] {
  const material: Defense[] = [
    { key: "falta_derecho", label: "Falta de derecho", kind: "material", ref: "", hint: "La parte actora no tiene el derecho que reclama." },
    { key: "falta_legitimacion_activa", label: "Falta de legitimación activa", kind: "material", ref: "", hint: "Quien demanda no es titular del derecho reclamado." },
    { key: "falta_legitimacion_pasiva", label: "Falta de legitimación pasiva", kind: "material", ref: "", hint: "Tu cliente no es quien debe responder por lo reclamado." },
    { key: "prescripcion", label: "Prescripción", kind: "material", ref: kind === "laboral" ? "CT art. 504" : "CPC art. 37.2", hint: "El plazo para reclamar ya transcurrió (indica desde cuándo y la norma)." },
    { key: "pago", label: "Pago", kind: "material", ref: "", hint: "La obligación ya se pagó (aporta los comprobantes)." },
    { key: "transaccion", label: "Transacción", kind: "material", ref: kind === "laboral" ? "CT art. 504" : "CPC art. 37.2", hint: "Hubo un acuerdo que resolvió el conflicto." },
    { key: "cosa_juzgada", label: "Cosa juzgada", kind: "material", ref: kind === "laboral" ? "CT art. 504" : "CPC art. 37.2", hint: "Ya hubo sentencia firme sobre lo mismo entre las mismas partes." },
    { key: "caducidad", label: "Caducidad", kind: "material", ref: kind === "laboral" ? "CT art. 504" : "CPC art. 37.2", hint: "Venció un plazo de caducidad previsto por la ley sustantiva." },
  ];
  if (kind === "laboral") {
    return [
      { key: "incompetencia_materia", label: "Incompetencia por razón de la materia", kind: "procesal", ref: "CT art. 437", hint: "Solo al contestar; se rechaza de plano si lo pedido es de naturaleza laboral incuestionable." },
      { key: "incompetencia_territorio", label: "Incompetencia por razón del territorio", kind: "procesal", ref: "CT art. 440", hint: "Solo puede protestarse al contestar la demanda." },
      ...material,
    ];
  }
  if (kind === "ordinario_civil" || kind === "sumario_civil" || kind === "monitorio") {
    return [
      { key: "falta_competencia", label: "Falta de competencia", kind: "procesal", ref: "CPC art. 37.3", hint: "El tribunal no es competente." },
      { key: "acuerdo_arbitral", label: "Acuerdo arbitral", kind: "procesal", ref: "CPC art. 37.3", hint: "Las partes pactaron resolverlo por arbitraje." },
      { key: "litisconsorcio", label: "Litisconsorcio necesario incompleto", kind: "procesal", ref: "CPC art. 37.3", hint: "Falta demandar a alguien que necesariamente debe ser parte." },
      { key: "indebida_acumulacion", label: "Indebida acumulación de pretensiones", kind: "procesal", ref: "CPC art. 37.3", hint: "Se mezclan pretensiones que no pueden ir juntas." },
      { key: "litispendencia", label: "Litispendencia", kind: "procesal", ref: "CPC art. 37.3", hint: "Ya hay otro proceso en curso sobre lo mismo." },
      ...material,
    ];
  }
  return material;
}

/* ---------------- Lo que responde el abogado ---------------- */

export type Answers = {
  facts: Record<string, { a?: FactAnswer; why?: string }>;
  claims: Record<string, { allanamiento?: boolean; parcial?: boolean; why?: string }>;
  evidence: Record<string, { objection?: string }>;
  defenses: Record<string, { on?: boolean; why?: string }>;
  ownEvidence: string;
  legalGrounds: string;
  estimatePosition: string;
  notifiedOn: string;
  process?: ProcessKind;
};

export const emptyAnswers = (): Answers => ({ facts: {}, claims: {}, evidence: {}, defenses: {}, ownEvidence: "", legalGrounds: "", estimatePosition: "", notifiedOn: "" });

/** Limpia lo recibido del navegador: solo claves conocidas y textos de tamaño razonable. */
export function sanitizeAnswers(raw: unknown, a: DemandAnalysis): Answers {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const obj = (x: unknown) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});
  const txt = (x: unknown, max = 6000) => (typeof x === "string" ? x.slice(0, max) : "");
  const out = emptyAnswers();
  for (const f of a.facts) {
    const v = obj(obj(r.facts)[String(f.n)]);
    const ans = typeof v.a === "string" && v.a in FACT_ANSWERS ? (v.a as FactAnswer) : undefined;
    if (ans || v.why) out.facts[String(f.n)] = { a: ans, why: txt(v.why) };
  }
  for (const c of a.claims) {
    const v = obj(obj(r.claims)[String(c.n)]);
    if (v.allanamiento || v.parcial || v.why) out.claims[String(c.n)] = { allanamiento: v.allanamiento === true, parcial: v.allanamiento !== true && v.parcial === true, why: txt(v.why) };
  }
  for (const e of a.evidence) {
    const v = obj(obj(r.evidence)[String(e.n)]);
    if (v.objection) out.evidence[String(e.n)] = { objection: txt(v.objection, 3000) };
  }
  const kind = typeof r.process === "string" && r.process in PROCESSES ? (r.process as ProcessKind) : a.process;
  for (const d of defensesFor(kind)) {
    const v = obj(obj(r.defenses)[d.key]);
    if (v.on || v.why) out.defenses[d.key] = { on: v.on === true, why: txt(v.why) };
  }
  out.ownEvidence = txt(r.ownEvidence, 20000);
  out.legalGrounds = txt(r.legalGrounds, 20000);
  out.estimatePosition = txt(r.estimatePosition, 3000);
  out.notifiedOn = typeof r.notifiedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.notifiedOn) ? r.notifiedOn : "";
  out.process = kind;
  return out;
}

export function progress(a: DemandAnalysis, ans: Answers): { facts: number; total: number } {
  return { facts: a.facts.filter((f) => ans.facts[String(f.n)]?.a).length, total: a.facts.length };
}

const sentence = (s: string) => {
  // Cada respuesta va en una sola línea (el formulario separa los puntos por saltos de línea).
  const t = s.replace(/\s*\n+\s*/g, " ").trim();
  return t ? (/[.!?»)]$/.test(t) ? t : `${t}.`) : "";
};

/**
 * Valores para el formulario «Contestación de demanda» (lib/forms): la respuesta a cada hecho en orden,
 * las excepciones razonadas, la posición sobre pretensiones y prueba, la prueba propia y el derecho.
 */
export function answerValues(a: DemandAnalysis, ans: Answers): Record<string, string> {
  const facts = a.facts.map((f) => {
    const r = ans.facts[String(f.n)];
    const base = r?.a ? FACT_ANSWERS[r.a] : "[PENDIENTE: indicar si se admite, se admite con variantes, se rechaza o se desconoce]";
    const why = r?.why?.trim();
    if (!why) return sentence(base);
    return r?.a === "admito" ? `${sentence(base)} ${sentence(why)}` : `${base}: ${sentence(why)}`;
  });
  const kind = ans.process ?? a.process;
  const defenses = defensesFor(kind)
    .filter((d) => ans.defenses[d.key]?.on)
    .map((d) => `${d.kind === "procesal" ? "Excepción procesal" : "Excepción"} de ${d.label.toLowerCase()}${d.ref ? ` (${d.ref})` : ""}: ${sentence(ans.defenses[d.key]?.why || "[PENDIENTE: razonar la excepción]")}`);
  const claims = a.claims.map((c) => {
    const r = ans.claims[String(c.n)];
    // Si la razón ya está redactada como postura («Me allano a que…»), se usa tal cual.
    if (r?.why?.trim() && /^(?:me\s+(?:allano|opongo)|acepto|no\s+me\s+opongo|solicito)\b/i.test(r.why.trim())) return `En cuanto a la pretensión ${c.n}: ${sentence(r.why)}`;
    if (r?.allanamiento) return `Me allano a la pretensión ${c.n}. ${sentence(r.why ?? "")}`.trim();
    return `Me opongo${r?.parcial ? " parcialmente" : ""} a la pretensión ${c.n}${r?.why?.trim() ? `: ${sentence(r.why)}` : "."}`;
  });
  if (ans.estimatePosition.trim()) claims.push(`Sobre la estimación: ${sentence(ans.estimatePosition)}`);
  const evidence = a.evidence.filter((e) => ans.evidence[String(e.n)]?.objection?.trim()).map((e) => `Sobre la prueba ${e.n} de la parte actora (${e.text.slice(0, 80)}${e.text.length > 80 ? "…" : ""}): ${sentence(ans.evidence[String(e.n)]!.objection!)}`);
  return {
    hechos: facts.join("\n"),
    excepciones: defenses.join("\n"),
    pretensiones: claims.join("\n"),
    pruebaActora: evidence.join("\n"),
    prueba: ans.ownEvidence,
    derecho: ans.legalGrounds,
    tipoProceso: PROCESSES[kind].label.replace(/^Proceso\s+/i, "").replace(/^./, (c) => c.toUpperCase()),
  };
}
