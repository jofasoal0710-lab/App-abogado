import "server-only";
import { accentVariants, excerpt, styleIssues, wordsToCheck, type TextIssue } from "./text-rules";

/**
 * Corrector ortográfico en español (diccionario Hunspell «es», en el propio servidor: el texto de los
 * escritos NO sale de la aplicación) más las reglas de estilo de text-rules.ts.
 */

/** Términos jurídicos y latinismos habituales que el diccionario general no trae. */
const LEGAL_WORDS = [
  "litisconsorcio", "litisconsorte", "litisconsortes", "litis", "supra", "infra", "sine", "qua", "non", "quo", "quem", "iuris", "juris", "tantum", "limine", "prima", "facie",
  "ad", "hoc", "ut", "et", "al", "bis", "ter", "quater", "inc", "lic", "licda", "licdo", "cpc", "cpca", "cpp", "lgap", "srl", "ltda", "notarial", "notariales", "protocolizar",
  "protocolización", "apostilla", "apostillado", "cesantía", "preaviso", "acójase", "acójanse", "téngase", "tómese", "notifíquese", "resuélvase", "comuníquese", "cúmplase",
  "remátese", "embárguese", "deniégase", "rechácese", "admítase", "confírmase", "revócase", "anúlase", "díctese", "otórguese", "señálese", "subsidio", "sinpe",
];

type Speller = { correct(w: string): boolean; suggest(w: string): string[] };
let speller: Promise<Speller> | null = null;

function getSpeller(): Promise<Speller> {
  speller ??= (async () => {
    const nspell = (await import("nspell")).default;
    const dict = (await import("dictionary-es")).default;
    const s = nspell({ aff: Buffer.from(dict.aff), dic: Buffer.from(dict.dic) });
    for (const w of LEGAL_WORDS) s.add(w);
    return s;
  })();
  return speller;
}

const MAX_ISSUES = 150;

export async function checkText(text: string): Promise<TextIssue[]> {
  const issues = styleIssues(text);
  const s = await getSpeller();
  const seen = new Set<string>();
  for (const { word, index } of wordsToCheck(text)) {
    if (s.correct(word)) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Lo más común es la tilde que falta: se prueba primero, y luego las sugerencias del diccionario.
    const accented = accentVariants(word).filter((v) => s.correct(v));
    const suggestions = [...new Set([...accented, ...s.suggest(word)])].slice(0, 4);
    issues.push({
      kind: "ortografia",
      message: suggestions.length ? `«${word}» no está en el diccionario. ¿Quisiste decir «${suggestions[0]}»?` : `«${word}» no está en el diccionario.`,
      excerpt: excerpt(text, index, word.length),
      index,
      word,
      suggestions,
    });
    if (issues.length > MAX_ISSUES) break;
  }
  return issues.sort((a, b) => a.index - b.index).slice(0, MAX_ISSUES);
}

export type FieldIssues = { field: string; label: string; issues: TextIssue[] };

/** Revisa varios campos (los de un formulario) y devuelve solo los que tienen algo. */
export async function checkFields(fields: { field: string; label: string; text: string }[]): Promise<FieldIssues[]> {
  const out: FieldIssues[] = [];
  for (const f of fields) {
    if (!f.text.trim()) continue;
    const issues = await checkText(f.text.slice(0, 50_000));
    if (issues.length) out.push({ field: f.field, label: f.label, issues });
  }
  return out;
}
