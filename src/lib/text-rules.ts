/**
 * Revisión de estilo de un texto, sin diccionario ni servicios externos: repeticiones, espacios,
 * puntuación, signos sin cerrar, mayúscula tras punto y huecos sin completar.
 */
export type IssueKind = "ortografia" | "repeticion" | "espacios" | "puntuacion" | "signos" | "mayuscula" | "vacio";
export type TextIssue = { kind: IssueKind; message: string; excerpt: string; index: number; word?: string; suggestions?: string[] };

export const ISSUE_LABELS: Record<IssueKind, string> = {
  ortografia: "Ortografía",
  repeticion: "Palabra repetida",
  espacios: "Espacios",
  puntuacion: "Puntuación",
  signos: "Signos sin cerrar",
  mayuscula: "Mayúscula",
  vacio: "Sin completar",
};

/** Abreviaturas tras las que puede seguir minúscula («art. 29», «inc. a)», «Lic. Pérez»…). */
const ABBREVIATIONS = new Set([
  "art", "arts", "inc", "incs", "lic", "licda", "licdo", "dr", "dra", "sr", "sra", "srta", "no", "n", "nº", "núm", "etc", "p", "pp", "pág", "págs",
  "cfr", "ss", "ej", "a", "s", "c", "vs", "op", "cit", "ib", "id", "ibíd", "vid", "fs", "fol", "exp", "ced", "céd", "aprox", "tel", "cap", "tít", "ref", "av", "ave", "bº", "mts", "km",
]);

export function excerpt(text: string, index: number, length = 0): string {
  const from = Math.max(0, index - 25);
  const to = Math.min(text.length, index + length + 25);
  return `${from > 0 ? "…" : ""}${text.slice(from, to).replace(/\s+/g, " ")}${to < text.length ? "…" : ""}`;
}

export function styleIssues(text: string): TextIssue[] {
  const out: TextIssue[] = [];
  const add = (kind: IssueKind, message: string, index: number, length = 0, extra: Partial<TextIssue> = {}) =>
    out.push({ kind, message, excerpt: excerpt(text, index, length), index, ...extra });

  for (const m of text.matchAll(/_{3,}/g)) add("vacio", "Queda un espacio por completar («____»).", m.index!, m[0].length);
  for (const m of text.matchAll(/\b(\p{L}+)\s+\1\b/giu)) {
    // «que que», «de de»… pero no «nos nos» ni números.
    if (m[1].length > 1 || /[aeoy]/i.test(m[1])) add("repeticion", `«${m[1]}» aparece dos veces seguidas.`, m.index!, m[0].length, { word: m[0], suggestions: [m[1]] });
  }
  for (const m of text.matchAll(/[^\S\n]{2,}/g)) add("espacios", "Hay espacios dobles.", m.index!, m[0].length, { word: m[0], suggestions: [" "] });
  for (const m of text.matchAll(/[^\S\n]+([,.;:])/g)) add("espacios", `Sobra el espacio antes de «${m[1]}».`, m.index!, m[0].length, { word: m[0], suggestions: [m[1]] });
  for (const m of text.matchAll(/[,;](?=\p{L})/gu)) add("puntuacion", `Falta un espacio después de «${m[0]}».`, m.index!, 1);
  // Punto pegado a la palabra siguiente, salvo abreviaturas, siglas (S.A.), decimales, correos y direcciones web.
  for (const m of text.matchAll(/(\S*)\.(?=\p{Lu}\p{Ll}{2,})/gu)) {
    const before = m[1];
    if (/@|https?:|www|\.\p{L}$/u.test(before) || /^\p{Lu}$/u.test(before) || ABBREVIATIONS.has(before.toLowerCase())) continue;
    add("puntuacion", "Falta un espacio después del punto.", m.index! + before.length, 1);
  }
  // Mayúscula después de punto final (no tras abreviaturas ni números como «N.° 9342»).
  for (const m of text.matchAll(/(\S+)([.!?])\s+(\p{Ll}\p{L}*)/gu)) {
    const prev = m[1].replace(/[^\p{L}º°]/gu, "").toLowerCase();
    if (m[2] === "." && (ABBREVIATIONS.has(prev) || /\d$/.test(m[1]) || /^\p{L}$/u.test(prev) || /\.\p{L}+$/u.test(m[1]))) continue;
    add("mayuscula", `Después de «${m[2]}» la palabra «${m[3]}» debería empezar con mayúscula.`, m.index! + m[1].length, m[0].length - m[1].length);
  }
  const pairs: [string, string, string][] = [
    ["(", ")", "paréntesis"],
    ["«", "»", "comillas «»"],
    ["“", "”", "comillas “”"],
    ["¿", "?", "signos de interrogación"],
    ["¡", "!", "signos de exclamación"],
  ];
  // «inciso a)», «b)», «1)»: enumeraciones con solo el paréntesis de cierre, habituales en escritos.
  const counted = text.replace(/(^|[\s(«“])(?:[a-zñ]|\d{1,2})\)/gimu, "$1");
  for (const [open, close, name] of pairs) {
    const o = counted.split(open).length - 1;
    const c = counted.split(close).length - 1;
    if (o !== c) {
      const i = o > c ? text.lastIndexOf(open) : text.lastIndexOf(close);
      add("signos", `Los ${name} no están equilibrados (${o} de apertura y ${c} de cierre).`, Math.max(0, i), 1);
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Palabras que se revisan con el diccionario: en minúscula, sin cifras; los nombres propios se saltan. */
export function wordsToCheck(text: string): { word: string; index: number }[] {
  const clean = text.replace(/\S+@\S+|https?:\/\/\S+|www\.\S+/g, (m) => " ".repeat(m.length));
  const out: { word: string; index: number }[] = [];
  for (const m of clean.matchAll(/\p{L}+(?:['’]\p{L}+)?/gu)) {
    const w = m[0];
    // Fuera: una letra, nombres propios y siglas (mayúsculas) y ordinales/abreviaturas («nº», «1ª»).
    if (w.length < 2 || /\p{Lu}/u.test(w) || /[ºª°]/.test(w)) continue;
    out.push({ word: w, index: m.index! });
  }
  return out;
}

/** Variantes con tilde («habia» → «había», «tecnica» → «técnica», «ano» → «año»). */
export function accentVariants(word: string): string[] {
  const map: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
  const out: string[] = [];
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (map[ch]) out.push(word.slice(0, i) + map[ch] + word.slice(i + 1));
    if (ch === "n") out.push(word.slice(0, i) + "ñ" + word.slice(i + 1));
    if (ch === "u") out.push(word.slice(0, i) + "ü" + word.slice(i + 1));
  }
  return out;
}
