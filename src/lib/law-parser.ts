/**
 * Convierte el texto completo de una ley (copiado del SCIJ / SINALEVI o de un PDF pasado a texto) en
 * artículos: número, ubicación (título · capítulo · sección) y cuerpo, con sus notas de reforma.
 */
export type ParsedArticle = { ordinal: number; number: string; heading: string | null; body: string };

const ARTICLE = /^(?:ART[IÍ]CULO|Art[ií]culo)\s+(\d+|[IVXLCDM]+)\s*[º°]?\s*(bis|ter|qu[aá]ter|quinquies|sexies)?\s*(?:[.\-—–]+\s*|$)/u;
const HEADING = /^(LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N)\b\s*(.*)$/iu;
const LEVEL: Record<string, number> = { libro: 0, titulo: 1, capitulo: 2, seccion: 3 };
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** Pie de página de SINALEVI: a partir de aquí ya no es la ley. */
const END = /^Ir al men[uú] de normativa$/;
const NOISE = /^Ficha Art[ií]culo\b/;
const REFORMS = /^\s*(reformas?\b|.{0,40}\bse (reforman|adicionan|modifican) (las|los) siguientes\b)/i;

/** «CAPITULO SEGUNDO» → «Capitulo segundo»; los números romanos se quedan en mayúscula («Sección II»). */
const titleCase = (raw: string) => {
  const s = raw.replace(/\(\*\)/g, "").trim();
  const t = s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
  return t.replace(/\b(i{1,3}|iv|vi{0,3}|ix|xi{0,3}|xiv|xv)\b/g, (m) => m.toUpperCase());
};
/** Un nombre de capítulo partido en dos líneas termina en «de», «y», «las»…: se une con la siguiente. */
const UNFINISHED = /\b(de|del|la|las|los|el|y|e|en|a|al|o|u|para|por|con|sobre)$/i;

/** Número normalizado: «1º» → «1», «97bis» → «97 bis», «XII» → «XII». */
export function normalizeArticleNumber(n: string, suffix?: string): string {
  return `${n.toUpperCase()}${suffix ? ` ${fold(suffix)}` : ""}`;
}

export function parseLawText(text: string): ParsedArticle[] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim());
  const out: ParsedArticle[] = [];
  const headings: (string | null)[] = [null, null, null, null];
  let pendingHeading: number | null = null;
  let continueName: number | null = null;
  let current: { number: string; heading: string | null; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    out.push({ ordinal: out.length + 1, number: current.number, heading: current.heading, body });
    current = null;
  };
  const headingText = () => headings.filter(Boolean).join(" · ") || null;

  for (const line of lines) {
    if (END.test(line)) break;
    if (NOISE.test(line)) continue;
    const h = HEADING.exec(line);
    if (h && line.length < 120 && !/[.;:]$/.test(line)) {
      const level = LEVEL[fold(h[1])];
      headings[level] = titleCase(line);
      for (let i = level + 1; i < headings.length; i++) headings[i] = null;
      pendingHeading = level;
      continue;
    }
    // El nombre de un título o capítulo va en la línea siguiente («Disposiciones generales»).
    if (continueName !== null && line && !ARTICLE.test(line) && line.length < 140) {
      headings[continueName] = `${headings[continueName]} ${line.toLowerCase()}`;
      continueName = UNFINISHED.test(line) ? continueName : null;
      continue;
    }
    continueName = line ? null : continueName;
    if (pendingHeading !== null && line && !ARTICLE.test(line)) {
      if (line.length < 140 && !/[.;:]$/.test(line)) {
        headings[pendingHeading] = `${headings[pendingHeading]}: ${titleCase(line)}`;
        if (UNFINISHED.test(line)) continueName = pendingHeading;
        pendingHeading = null;
        continue;
      }
      pendingHeading = null;
    }
    const a = ARTICLE.exec(line);
    // Texto futuro citado en una nota de SINALEVI («a partir de esa fecha el texto de este numeral se
    // leerá así: “…”»): el mismo número repetido es parte de la nota, no un artículo nuevo.
    if (a && current && normalizeArticleNumber(a[1], a[2]) === current.number && /se leer[aá] (de la siguiente manera|as[ií])/i.test(current.lines.slice(-3).join(" "))) {
      current.lines.push(line);
      continue;
    }
    // Artículo de reformas («Se reforman las siguientes disposiciones…»): los artículos de otras leyes
    // que cita van dentro de él; solo el número siguiente (184 → 185) abre un artículo nuevo.
    if (a && current && REFORMS.test(current.lines.slice(0, 4).join(" "))) {
      const next = normalizeArticleNumber(a[1], a[2]);
      if (!/^\d+$/.test(current.number) || next !== String(Number(current.number) + 1)) {
        current.lines.push(line);
        continue;
      }
    }
    if (a) {
      flush();
      pendingHeading = null;
      // El cuerpo empieza después de «ARTICULO 2º.-» (el número se guarda aparte).
      current = { number: normalizeArticleNumber(a[1], a[2]), heading: headingText(), lines: [line.slice(a[0].length)] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return out;
}

/** «29», «28 y 29», «1, 2 y 5», «31 al 35», «94 bis» → números de artículo (rangos de hasta 30). */
export function articleNumbersFrom(spec: string | null | undefined): string[] {
  if (!spec) return [];
  const s = fold(spec).replace(/^art[ií]?culos?\s*/, "");
  const out: string[] = [];
  for (const part of s.split(/\s*(?:,|;|\by\b|\be\b)\s*/)) {
    const range = /^(\d+)\s*(?:al|a|-|–)\s*(\d+)$/.exec(part.trim());
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      if (to >= from && to - from <= 30) for (let i = from; i <= to; i++) out.push(String(i));
      continue;
    }
    const one = /^(\d+|[ivxlcdm]+)\s*(bis|ter|quater|quinquies|sexies)?$/.exec(part.trim());
    if (one) out.push(normalizeArticleNumber(one[1], one[2]));
  }
  return [...new Set(out)];
}

/**
 * Lista de artículos elegidos → texto corto para citar: «28 a 31, 45 y 97 bis». Los consecutivos se
 * agrupan en rangos (que articleNumbersFrom vuelve a entender).
 */
export function joinArticleNumbers(numbers: string[]): string {
  const key = (n: string) => {
    const m = /^(\d+)\s*(.*)$/.exec(n);
    return m ? [Number(m[1]), m[2]] as const : [Number.MAX_SAFE_INTEGER, n] as const;
  };
  const uniq = [...new Set(numbers.map((n) => n.trim()).filter(Boolean))].sort((a, b) => {
    const [na, sa] = key(a), [nb, sb] = key(b);
    return na - nb || sa.localeCompare(sb);
  });
  const parts: string[] = [];
  for (let i = 0; i < uniq.length; i++) {
    const start = uniq[i];
    if (!/^\d+$/.test(start)) { parts.push(start); continue; }
    let j = i;
    while (j + 1 < uniq.length && /^\d+$/.test(uniq[j + 1]) && Number(uniq[j + 1]) === Number(uniq[j]) + 1 && Number(uniq[j + 1]) - Number(start) < 30) j++;
    parts.push(j - i >= 2 ? `${start} a ${uniq[j]}` : uniq.slice(i, j + 1).join(", "));
    i = j;
  }
  const flat = parts.join(", ").split(", ");
  return flat.length > 1 ? `${flat.slice(0, -1).join(", ")} y ${flat[flat.length - 1]}` : flat[0] ?? "";
}
