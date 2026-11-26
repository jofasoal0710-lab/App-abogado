/**
 * Análisis «punto por punto» de una demanda, sin inteligencia artificial: cada hecho se divide en sus
 * afirmaciones, cada afirmación se clasifica (dato registral, cita jurídica, valoración, imputación, bienes,
 * hijos, convivencia, hecho propio del actor) y con eso se estima si el hecho es controvertido y se proponen
 * respuestas redactadas, con la recomendada primero. Lo mismo para cada pretensión y para la prueba.
 *
 * Lógica pura (la usan la pantalla y los tests). Son propuestas: el abogado o la abogada elige y corrige.
 * Las normas que se citan aquí están comprobadas en los textos de SINALEVI cargados en la app
 * (Código de Familia arts. 41, 48 y 57).
 */
import { findDates, type DemandAnalysis, type FactAnswer, type Item } from "./demand-analysis";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dmy = (iso: string) => iso.split("-").reverse().join("/");

/* ---------------- Tipos ---------------- */

export type Nature = "registral" | "juridico" | "valorativo" | "imputacion" | "patrimonial" | "menores" | "convivencia" | "propio_actor" | "neutro";
export type Controversy = "sin_controversia" | "confirmar" | "parcial" | "controvertido" | "no_es_hecho";

export const NATURE_LABELS: Record<Nature, string> = {
  registral: "Dato registral o documental",
  juridico: "Cita o apreciación jurídica",
  valorativo: "Valoración o reproche",
  imputacion: "Imputación a tu cliente",
  patrimonial: "Bienes y dinero",
  menores: "Hijos",
  convivencia: "Convivencia y separación",
  propio_actor: "Hecho o intención propia del actor",
  neutro: "Hecho por confirmar",
};

export const CONTROVERSY_LABELS: Record<Controversy, { label: string; help: string }> = {
  sin_controversia: { label: "Sin controversia", help: "Dato objetivo que consta en documentos públicos: en principio conviene admitirlo." },
  confirmar: { label: "Confirmar con el cliente", help: "Hecho objetivo que no consta en documentos: depende de la versión de tu cliente." },
  parcial: { label: "Controversia parcial", help: "Mezcla datos ciertos con valoraciones o afirmaciones discutibles: admitir una parte y rectificar el resto." },
  controvertido: { label: "Controvertido", help: "Valoraciones, reproches o imputaciones: hay que fijar la versión de tu cliente." },
  no_es_hecho: { label: "No es un hecho", help: "Es una cita normativa o una conclusión jurídica: no se admite ni se rechaza como hecho." },
};

export type Assertion = { text: string; nature: Nature; signal: string };
export type FactOption = { a: FactAnswer; label: string; why: string; recommended?: boolean; when?: string };
export type FactPoint = {
  n: number;
  title: string | null;
  controversy: Controversy;
  assertions: Assertion[];
  options: FactOption[];
  hints: string[];
};

export type ClaimStance = "favorable" | "neutral" | "desfavorable" | "revisar";
export const STANCE_LABELS: Record<ClaimStance, string> = { favorable: "Te favorece", neutral: "Neutral", desfavorable: "En contra", revisar: "Revisar" };
export type ClaimChoice = "allano" | "parcial" | "opongo";
export type ClaimOption = { choice: ClaimChoice; label: string; why: string; recommended?: boolean; when?: string };
export type ClaimPoint = { n: number; title: string | null; topic: string; stance: ClaimStance; options: ClaimOption[]; hints: string[] };

export type EvidencePoint = { n: number; hints: { text: string; objection: string }[] };

export type PointContext = {
  /** Texto completo de la demanda (para datos que no quedan en el análisis guardado: titularidad, fecha…). */
  text: string;
  clientName?: string | null;
  today: string;
};

export type PointByPoint = {
  facts: FactPoint[];
  claims: ClaimPoint[];
  evidence: EvidencePoint[];
  /** Resumen: qué hechos caen en cada nivel de controversia. */
  summary: Record<Controversy, number[]>;
  /** Papel de tu cliente que se deduce del escrito («madre», «esposa»…), para orientar las propuestas. */
  clientRole: { female: boolean; parent: boolean };
};

/* ---------------- Afirmaciones ---------------- */

/** «Del Matrimonio: Contraje matrimonio…» → título «Del Matrimonio» y el resto. */
export function splitTitle(text: string): { title: string | null; body: string } {
  const m = /^\s*((?:de|del|sobre|en cuanto a|acerca de|causal|la|el|los|las)\b[^:.]{2,60}):\s*(.+)$/is.exec(text);
  if (m && m[1].split(/\s+/).length <= 7) return { title: m[1].trim(), body: m[2].trim() };
  return { title: null, body: text.trim() };
}

const CONNECTORS = /,?\s+(?=(?:no\s+obstante|sin\s+embargo|por\s+lo\s+que|pero|al\s+punto\s+(?:de\s+)?que|despu[eé]s\s+del?|lo\s+que\s+hizo|aunque|mientras|y\s+es\s+precisamente|y\s+hoy\s+d[ií]a|mediante\s+el\s+cual|al\s+inicio)\b)/i;

/** Divide un hecho en afirmaciones: frases, y las frases largas por sus conectores («no obstante», «por lo que»…). */
export function splitAssertions(body: string): string[] {
  const sentences = body
    .replace(/\s+/g, " ")
    .split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ¿«"►(])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    const parts = s.length > 200 ? s.split(CONNECTORS) : [s];
    for (const raw of parts) {
      const p = raw.replace(/^[,;\s]+/, "").trim();
      if (!p) continue;
      // Trozos muy cortos se unen al anterior (no son una afirmación por sí solos).
      if (p.length < 35 && out.length) out[out.length - 1] += ` ${p}`;
      else out.push(p);
    }
  }
  return out;
}

type Rule = { nature: Nature; rx: RegExp; signal: string };
const RULES: Rule[] = [
  { nature: "imputacion", rx: /\b(medidas?\s+de\s+proteccion|violencia|agred\w*|agresi\w*|maltrat\w*|amenaz\w*|insult\w*|denunci\w*|golpe\w*|abus\w*|infidel\w*|adulteri\w*|alcohol\w*|drogas?|celos\w*|humill\w*|acos\w*)\b/, signal: "atribuye conductas a tu cliente" },
  { nature: "valorativo", rx: /\b(insoportable|perdid[oa]\s+el\s+respeto|complicad\w*|no\s+funciona|culpa\w*|meter\s+en\s+la\s+relacion|se\s+(?:empezaron|metian?)\s+a\s+meter|irrespet\w*|conflict\w*|discusion\w*|problemas?|no\s+pudimos|lo\s+mejor|relativamente|estable|inestab\w*|toxic\w*|incompatibilidad|rumbos\s+diferentes|situacion\s+que\s+vivo|desamor|indiferen\w*|imposible\s+(?:la\s+)?convivencia|sin\s+posibilidad\w*|no\s+hay\s+razon)\b/, signal: "valoración o reproche" },
  { nature: "juridico", rx: /\b(ley\s+n|ley\s+\d|articulo|art\.|codigo\s+(?:de|procesal|civil)|inciso|gaceta|entro\s+en\s+vigencia|vigencia|reforma\w*|jurisprudencia|sala\s+(?:segunda|primera|constitucional)|sera\s+motivo|de\s+conformidad\s+con)\b/, signal: "cita normas o hace una conclusión jurídica" },
  { nature: "patrimonial", rx: /\b(ganancial\w*|bien(?:es)?\s+(?:inmueble|mueble)s?|finca|lote|inversion|millones|colones|hipoteca|credito\w*|prestamo\w*|bono\s+de\s+vivienda|segrega\w*|vehiculo\w*|ahorro\w*|salario\w*|deuda\w*|a\s+titulo\s+oneroso)\b/, signal: "bienes, inversiones o deudas" },
  { nature: "registral", rx: /\b(registro\s+(?:civil|publico|de\s+(?:matrimonios|nacimientos)|nacional)|inscrit[oa]|tomo\s+\d|folio\s*\d|asiento\s+\d|certificacion\w*|matricula|plano\s+catastrado|citas\s+de\s+inscripcion)\b/, signal: "consta en el Registro o en una certificación" },
  { nature: "menores", rx: /\b(hij[oa]s?|menor(?:es)?\s+de\s+edad|el\s+menor|la\s+menor|nacid[oa]|nacimiento|procreamos)\b/, signal: "hijos" },
  { nature: "convivencia", rx: /\b(separad[oa]s|separacion|convivencia|vida\s+en\s+comun|hogar|salir\s+de\s+(?:esa|la)\s+casa|abandonar\s+la\s+vivienda|me\s+sigui[oó]|nos\s+encontramos|casad[oa]s|union|matrimonio|relacion)\b/, signal: "convivencia, relación o separación" },
  { nature: "propio_actor", rx: /\b(me\s+percate|considere|considero|pretendo|siento|creo\s+que|decidi|mi\s+intencion|para\s+evitar|tuve\s+que|me\s+vi\s+obligad[oa]|mi\s+suegr[oa]|mis\s+suegros)\b/, signal: "hecho, intención o tercero del lado del actor" },
];

const FIRST_PERSON_EVENT = /\b(contraje|procreamos|adquirimos|me\s+present|vivimos|convivimos|nos\s+separamos|solicite|hice|tuve|nos\s+encontramos|vivo)\b/;

/** Clasifica una afirmación por la señal más fuerte que contiene. */
export function classifyAssertion(text: string): Assertion {
  const f = fold(text);
  const hits = RULES.filter((r) => r.rx.test(f));
  // Una cita jurídica con un hecho en primera persona («es esa la situación que vivo») no es solo jurídica.
  let pick = hits[0];
  // Una cita de la norma («será motivo de divorcio la incompatibilidad…») es jurídica aunque use palabras de reproche.
  const legal = hits.find((h) => h.nature === "juridico");
  if (legal && pick?.nature === "valorativo" && !FIRST_PERSON_EVENT.test(f)) pick = legal;
  if (pick?.nature === "juridico" && FIRST_PERSON_EVENT.test(f)) pick = hits.find((h) => h.nature !== "juridico") ?? pick;
  // Registro + bienes: manda «bienes» (la titularidad consta, la ganancialidad se discute).
  if (pick?.nature === "registral" && hits.some((h) => h.nature === "patrimonial")) pick = hits.find((h) => h.nature === "patrimonial")!;
  // Hijos + registro: es un dato registral.
  if (pick?.nature === "menores" && hits.some((h) => h.nature === "registral")) pick = hits.find((h) => h.nature === "registral")!;
  return { text, nature: pick?.nature ?? "neutro", signal: pick?.signal ?? "sin señales claras" };
}

/* ---------------- Datos que se citan en las respuestas ---------------- */

const short = (s: string, words = 14) => {
  const w = s.replace(/\s+/g, " ").trim().split(" ");
  return w.length <= words ? s.replace(/[.;,\s]+$/, "") : `${w.slice(0, words).join(" ")}…`;
};

/** Frase en tercera persona que resume lo que se admite de una afirmación objetiva. */
function topicOf(a: Assertion, full: string): string {
  const f = fold(a.text);
  const date = findDates(a.text)[0];
  const year = !date ? /\bel\s+ano\s+(\d{4})\b/.exec(f)?.[1] : undefined;
  if (/contraje\s+matrimonio|contrajimos\s+matrimonio|matrimonio\s+celebrado/.test(f)) return `que las partes contrajeron matrimonio${date ? ` el ${dmy(date)}` : year ? ` en ${year}` : ""}, según consta en el Registro Civil`;
  const child = /\b(?:al|a\s+la)\s+menor\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/.exec(a.text)?.[1];
  if (/procreamos|nacid[oa]|nacimiento/.test(f)) return `${child ? `que ${child} es hijo de ambas partes` : "la filiación del hijo o hija de ambas partes"}${date ? `, nacido el ${dmy(date)}` : ""}, según la certificación del Registro Civil`;
  const finca = /matr[ií]cula\s+(?:n[uú]mero\s+)?([\d-]{4,})/i.exec(a.text)?.[1];
  if (finca) return `la existencia de la finca matrícula ${finca} y de los gravámenes y limitaciones que constan en el Registro Inmobiliario`;
  if (/separad[oa]s/.test(f)) {
    const since = /desde\s+(?:el\s+mes\s+de\s+)?([a-z]+\s+de\s+\d{4})/.exec(f)?.[1];
    return `que las partes se encuentran separadas${since ? ` (el actor lo sitúa desde ${since})` : ""}`;
  }
  if (a.nature === "juridico") return "la existencia de la norma citada";
  void full;
  return `lo indicado en cuanto a «${short(a.text)}»`;
}

/* ---------------- Hechos ---------------- */

const has = (as: Assertion[], ...n: Nature[]) => as.some((a) => n.includes(a.nature));
const OBJECTIVE: Nature[] = ["registral", "menores"];

export function controversyOf(as: Assertion[], title: string | null = null): Controversy {
  if (!as.length) return "confirmar";
  const natures = new Set(as.map((a) => a.nature));
  if ([...natures].every((n) => OBJECTIVE.includes(n))) return "sin_controversia";
  const disputed = has(as, "valorativo", "imputacion");
  const legal = as.filter((a) => a.nature === "juridico").length;
  const legalTitle = !!title && /^(?:causal|del?\s+derecho|fundamentos?|de\s+la\s+causal)/i.test(title);
  if (legal && (legal >= as.length / 2 || legalTitle || as[0].nature === "juridico") && !has(as, "imputacion", "patrimonial")) return "no_es_hecho";
  if (disputed) return has(as, ...OBJECTIVE, "convivencia", "juridico", "patrimonial") ? "parcial" : "controvertido";
  if (has(as, "patrimonial")) return "parcial";
  return "confirmar";
}

const join = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join("; ")} y ${xs.at(-1)}`);
const PENDING_VERSION = "[PENDIENTE: versión de los hechos de nuestra representada y prueba que la respalda]";

function documentNote(text: string): string {
  const f = fold(text);
  if (/certificacion\s+de\s+matrimonio/.test(f)) return "Consta en la certificación de matrimonio aportada por la parte actora.";
  if (/certificacion\s+de\s+nacimiento/.test(f)) return "Consta en la certificación de nacimiento aportada por la parte actora.";
  if (/certificacion/.test(f)) return "Consta en la certificación aportada por la parte actora.";
  if (/registro/.test(f)) return "Consta en el Registro.";
  return "";
}

export function analyzeFact(fact: Item, ctx: { divorceByIncompatibility: boolean; clientFemale: boolean; fullText: string; filedOn?: string | null; marriedOn?: string | null }): FactPoint {
  const { title, body } = splitTitle(fact.text);
  const assertions = splitAssertions(body).map(classifyAssertion);
  const controversy = controversyOf(assertions, title);
  const hasFinca = assertions.some((a) => /matr[ií]cula/i.test(a.text));
  // La descripción registral de la finca («Sito:», «Mide:», «Linderos:») queda cubierta al admitir la finca.
  const describesFinca = (a: Assertion) => hasFinca && /^(?:sito|mide|linderos|naturaleza|plano)\b/i.test(a.text);
  const admit = assertions.filter((a) => !describesFinca(a) && (["registral", "menores", "convivencia"].includes(a.nature) || (a.nature === "patrimonial" && /matr[ií]cula|inscrit/i.test(a.text))));
  const imputations = assertions.filter((a) => a.nature === "imputacion");
  const valuations = assertions.filter((a) => a.nature === "valorativo");
  const money = assertions.filter((a) => a.nature === "patrimonial" && !admit.includes(a));
  const unknown = assertions.filter((a) => a.nature === "propio_actor");
  const legal = assertions.filter((a) => a.nature === "juridico");
  const deny = [...imputations, ...valuations, ...money];
  const rep = ctx.clientFemale ? "mi representada" : "mi representado";
  const quotes = (xs: Assertion[], max = 3, words = 14) => join(xs.slice(0, max).map((a) => `«${short(a.text, words)}»`)) + (xs.length > max ? ", entre otras" : "");

  // Lo que no tiene un tema concreto («me siguió un mes después») no se admite a ciegas: se deja para confirmar.
  const specific = (a: Assertion) => !topicOf(a, ctx.fullText).startsWith("lo indicado");
  const toConfirm = admit.filter((a) => a.nature === "convivencia" && !specific(a));
  const admitted = admit.filter((a) => !toConfirm.includes(a)).map((a) => topicOf(a, ctx.fullText));
  // La separación se admite aunque vaya en la misma frase que una imputación.
  if (!admitted.some((t) => t.includes("separadas"))) {
    const sep = assertions.find((a) => /separad[oa]s/i.test(a.text));
    if (sep) admitted.push(topicOf({ ...sep, nature: "convivencia" }, ctx.fullText));
  }
  const admitText = join([...new Set(admitted)]);
  // Aportes al bien: «con recursos propios… créditos personales a mi nombre» no se admite sin prueba.
  const ownFunds = assertions.some((a) => /recursos\s+propios|creditos?\s+personales|dinero\s+propio|con\s+mi\s+salario/i.test(fold(a.text)));
  const variantes = [
    admitText ? `Se admite ${admitText}.` : "",
    toConfirm.length ? `[PENDIENTE: confirmar con ${ctx.clientFemale ? "la clienta" : "el cliente"} si es cierto que ${quotes(toConfirm, 2)}].` : "",
    legal.length ? "Lo relativo a la normativa citada no es un hecho, sino fundamento jurídico de la parte actora." : "",
    imputations.length ? `No es cierto que ${rep} haya incurrido en las conductas que se le atribuyen (${quotes(imputations, 2, 18)}): ${PENDING_VERSION}.` : "",
    valuations.length ? `Las demás afirmaciones son apreciaciones subjetivas del actor sobre la relación, que no se aceptan (${quotes(valuations)}).` : "",
    money.length ? `No se admiten los montos, inversiones ni aportes que se afirman (${quotes(money, 2)}), por no estar acreditados.` : "",
    ownFunds ? `No se admite que las mejoras o el pago del bien se hayan hecho solo con recursos propios del actor o con créditos personales a su nombre: [PENDIENTE: aportes de ${rep}].` : "",
    unknown.length ? `Se desconoce lo indicado en cuanto a ${quotes(unknown, 2)}, por tratarse de apreciaciones o hechos propios del actor.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const denyText = quotes(deny);

  const options: FactOption[] = [];
  const add = (o: FactOption) => options.push(o);
  switch (controversy) {
    case "sin_controversia":
      add({ a: "admito", label: "Admitirlo", why: documentNote(body), recommended: true });
      add({ a: "variantes", label: "Admitirlo con una precisión", why: "Es cierto, con la siguiente precisión: [PENDIENTE: dato a rectificar].", when: "Si algún dato (fecha, citas de inscripción, nombre) no coincide con la certificación." });
      break;
    case "no_es_hecho": {
      const extra = deny.length ? ` En cuanto a ${denyText}, no es cierto: ${PENDING_VERSION}.` : "";
      add({ a: "no_hecho", label: "Señalar que no es un hecho", why: `Lo expuesto es una cita normativa y una apreciación jurídica de la parte actora, que no requiere ser admitida ni rechazada como hecho.${extra}`, recommended: true });
      if (ctx.divorceByIncompatibility) {
        add({ a: "variantes", label: "Admitir la incompatibilidad, sin culpas", why: `Es cierto que entre las partes existe incompatibilidad de caracteres que impide la vida en común. No es cierto que esa situación sea atribuible a ${rep}, ni que exista desde el inicio del matrimonio.`, when: "Si tu cliente también quiere el divorcio." });
      }
      add({ a: "rechazo", label: "Rechazarlo", why: `No es cierto que exista la incompatibilidad que se alega: ${PENDING_VERSION}.`, when: "Si tu cliente se opone al divorcio." });
      break;
    }
    case "parcial":
      add({ a: "variantes", label: "Admitir una parte y rectificar el resto", why: variantes, recommended: true });
      add({ a: "rechazo", label: "Rechazarlo tal como se narra", why: `No es cierto tal y como lo narra la parte actora. ${PENDING_VERSION}.` });
      if (unknown.length) add({ a: "desconozco", label: "Desconocerlo", why: "Se desconoce, por tratarse de hechos y apreciaciones propias del actor que no le constan a " + rep + ".", when: "Si tu cliente no presenció lo que se narra." });
      add({ a: "admito", label: "Admitirlo entero", why: "", when: "Solo si tu cliente está de acuerdo con todo el relato." });
      break;
    case "controvertido":
      add({ a: "rechazo", label: "Rechazarlo", why: `No es cierto. ${PENDING_VERSION}.`, recommended: true });
      add({ a: "variantes", label: "Admitirlo con rectificaciones", why: variantes || `Es cierto únicamente que [PENDIENTE]. No es cierto lo demás: ${PENDING_VERSION}.` });
      add({ a: "desconozco", label: "Desconocerlo", why: "Se desconoce, por tratarse de hechos propios del actor que no le constan a " + rep + "." });
      break;
    case "confirmar":
      add({ a: "admito", label: "Admitirlo (si tu cliente lo confirma)", why: "", recommended: true });
      add({ a: "variantes", label: "Admitirlo con rectificaciones", why: variantes || "Es cierto, con la siguiente rectificación: [PENDIENTE]." });
      add({ a: "rechazo", label: "Rechazarlo", why: `No es cierto. ${PENDING_VERSION}.` });
      add({ a: "desconozco", label: "Desconocerlo", why: "Se desconoce, por no constarle a " + rep + "." });
      break;
  }
  for (const o of options) o.why = o.why.replace(/\s+/g, " ").trim();

  /* Pistas para este hecho. */
  const hints: string[] = [];
  const f = fold(body);
  const otherCase = [...body.matchAll(/\b\d{2}-\d{6}-\d{4}-[A-Z]{2}\b/g)].map((m) => m[0]);
  if (has(assertions, "imputacion")) {
    hints.push(`Atribuye conductas a tu cliente${otherCase.length ? ` y menciona el expediente ${otherCase.join(", ")}` : ""}. Revisa cómo terminó ese proceso: si las medidas se levantaron o no se confirmaron, dilo y aporta la resolución. Rechaza expresamente cada imputación que no conste.`);
  } else if (otherCase.length) hints.push(`Menciona otro proceso (expediente ${otherCase.join(", ")}): pide copia y comprueba qué se resolvió.`);
  if (/bono\s+de\s+vivienda/.test(f)) hints.push("Indica que la casa se construyó con bono de vivienda: revisa en la certificación registral las limitaciones de la Ley 7052 y la afectación a habitación familiar antes de admitir el valor o la forma de repartir el bien.");
  if (/a\s+mi\s+nombre|inscrit[oa]\s+a\s+mi\s+nombre/.test(f) && /ganancial/.test(fold(ctx.fullText))) hints.push("Según el actor, los bienes o créditos están a su nombre: si se declaran gananciales, tu cliente tiene derecho a participar en la mitad de su valor neto (CF art. 41). Ojo con los créditos que el actor dice haber pagado: inciden en ese valor neto.");
  const amount = /\b(\w+)\s+millones\s+de\s+colones\b/.exec(f) ?? /₡\s?[\d.,]+|¢\s?[\d.,]+/.exec(body);
  if (amount && !/bono\s+de\s+vivienda/.test(f)) hints.push(`Menciona montos (${amount[0]}): no los admitas sin comprobantes.`);
  if (ctx.divorceByIncompatibility && has(assertions, "valorativo", "imputacion")) hints.push("En el divorcio por incompatibilidad de caracteres (CF art. 48, inciso 8) no hay que probar culpas: valora no discutir cada reproche y centrarte en lo que afecte a la guarda, los alimentos o los bienes.");
  // ¿Cuadra la duración que se afirma con las fechas?
  const yrs = /\b(?:poco\s+mas\s+de\s+|mas\s+de\s+|casi\s+)?(\d{1,2})\s+anos\b/.exec(f);
  if (yrs && ctx.marriedOn && ctx.filedOn) {
    const real = (Date.parse(ctx.filedOn) - Date.parse(ctx.marriedOn)) / (365.25 * 86_400_000);
    const said = Number(yrs[1]);
    if (Math.abs(real - said) >= 1.5) hints.push(`Dice «${yrs[0]}», pero entre el matrimonio (${dmy(ctx.marriedOn)}) y la fecha de la demanda (${dmy(ctx.filedOn)}) hay ${Math.floor(real)} años: puedes rectificarlo.`);
  }
  const since = /desde\s+(?:el\s+mes\s+de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\s+(?:de|del)\s+(\d{4})/.exec(f);
  if (since && /separad/.test(f)) hints.push(`El actor fecha la separación en ${since[1]} de ${since[2]}: confirma la fecha con tu cliente.`);

  return { n: fact.n, title, controversy, assertions, options, hints };
}

/* ---------------- Pretensiones ---------------- */

type ClaimRule = {
  topic: string;
  rx: RegExp;
  build: (c: { text: string; f: string; ctx: ClaimCtx }) => { stance: ClaimStance; options: ClaimOption[]; hints: string[] };
};
type ClaimCtx = { female: boolean; parent: boolean; actorOwns: boolean; rep: string; year: number; otherCases: string[] };

const allano = (why: string, extra: Partial<ClaimOption> = {}): ClaimOption => ({ choice: "allano", label: "Allanarse", why, ...extra });
const opongo = (why: string, extra: Partial<ClaimOption> = {}): ClaimOption => ({ choice: "opongo", label: "Oponerse", why, ...extra });
const parcial = (why: string, extra: Partial<ClaimOption> = {}): ClaimOption => ({ choice: "parcial", label: "Oponerse en parte", why, ...extra });

const CLAIM_RULES: ClaimRule[] = [
  {
    topic: "Costas",
    rx: /\bcostas\b/,
    build: () => ({
      stance: "desfavorable",
      options: [
        opongo("Solicito que se resuelva sin especial condena en costas, por haber existido motivo suficiente para litigar.", { recommended: true }),
        opongo("En caso de que se acoja el allanamiento, solicito que se resuelva sin condena en costas para mi representada, que no se opuso a lo que en derecho corresponde.", { label: "Oponerse (si te allanas a lo principal)" }),
      ],
      hints: [],
    }),
  },
  {
    topic: "Con lugar la demanda",
    rx: /\bcon\s+lugar\b.*\b(?:demanda|extremos)\b/,
    build: () => ({
      stance: "revisar",
      options: [
        parcial("Me opongo a que se declare con lugar en todos sus extremos, en los términos que se indican para cada pretensión.", { recommended: true }),
        opongo("Me opongo a que se declare con lugar la demanda, por las razones expuestas al contestar los hechos."),
      ],
      hints: ["Depende de lo que decidas en las demás pretensiones: si te allanas a alguna, oponte solo «en parte»."],
    }),
  },
  {
    topic: "Divorcio",
    rx: /\b(?:disolucion\s+del\s+vinculo|divorcio)\b/,
    build: ({ f, ctx }) => {
      const incompat = /incompatibilidad/.test(f);
      return {
        stance: "revisar",
        options: [
          allano(`Me allano a que se decrete el divorcio${incompat ? " por la causal de incompatibilidad de caracteres" : ""}, sin que ello implique aceptar los hechos que se atribuyen a ${ctx.rep}.`, { recommended: incompat, when: "Si tu cliente también quiere divorciarse." }),
          opongo(`Me opongo: no concurre la causal invocada. [PENDIENTE: razones de ${ctx.rep}].`, { when: "Si tu cliente quiere mantener el matrimonio." }),
        ],
        hints: incompat ? ["La incompatibilidad de caracteres es causal de divorcio (CF art. 48, inciso 8). Allanarse al divorcio no obliga a aceptar los hechos ni las demás pretensiones: puedes discutir solo los efectos (bienes, alimentos, hijos)."] : [],
      };
    },
  },
  {
    topic: "Bienes gananciales",
    rx: /\bganancial\w*/,
    build: ({ ctx }) => ({
      stance: ctx.actorOwns ? "favorable" : "revisar",
      options: [
        allano("Me allano a que se declare ganancial el bien indicado y a su distribución conforme al artículo 41 del Código de Familia, con derecho de mi representada a participar en la mitad de su valor neto.".replace("mi representada", ctx.rep), { recommended: ctx.actorOwns }),
        parcial("Me allano a que se declare ganancial el bien indicado, y solicito que se declaren también gananciales los siguientes bienes: [PENDIENTE: bienes a nombre del actor adquiridos durante el matrimonio].", { label: "Allanarse y pedir más bienes" }),
        opongo(`Me opongo: [PENDIENTE: el bien no es ganancial porque…].`, { when: "Si el bien está a nombre de tu cliente o se adquirió a título gratuito." }),
      ],
      hints: [
        ctx.actorOwns
          ? "El bien está inscrito a nombre del actor: declararlo ganancial da a tu cliente derecho a la mitad de su valor neto (CF art. 41). En principio te favorece."
          : "Comprueba a nombre de quién está el bien: cada cónyuge participa en la mitad del valor neto de los gananciales que constan en el patrimonio del otro (CF art. 41).",
        "Revisa si hay otros bienes a nombre del actor (vehículos, otras fincas, ahorros) para pedir que también se declaren gananciales.",
      ],
    }),
  },
  {
    topic: "Alimentos entre las partes",
    rx: /\balimentos\b.*\b(?:entre\s+(?:las\s+)?partes|reciproca\w*|entre\s+si|conyuges)\b|\bexima\b.*\balimentos\b/,
    build: ({ ctx }) => ({
      stance: "revisar",
      options: [
        allano("Me allano a que se exima a ambas partes de la obligación alimentaria entre sí.", { recommended: true, when: "Si tu cliente no necesita pensión del actor." }),
        opongo(`Me opongo: ${ctx.rep === "mi representada" ? "mi representada requiere" : "mi representado requiere"} una pensión alimentaria a cargo del actor, según las circunstancias (CF art. 57). [PENDIENTE: necesidades y capacidad económica].`, { when: "Si tu cliente depende económicamente del actor." }),
      ],
      hints: ["Aunque no haya cónyuge culpable, el tribunal puede conceder pensión a uno de los cónyuges «según las circunstancias» (CF art. 57)."],
    }),
  },
  {
    topic: "Alimentos para el hijo o hija",
    rx: /\balimentos?\b.*\b(?:menor|hij[oa]s?)\b|\bcuota\s+alimentaria\b/,
    build: ({ ctx }) => ({
      stance: "neutral",
      options: [
        allano(`Me allano a que se mantenga la cuota alimentaria vigente${ctx.otherCases.length ? `, fijada en el expediente ${ctx.otherCases.join(", ")}` : ""}.`, { recommended: true }),
        parcial("No me opongo a que se tenga por vigente la cuota alimentaria, pero se hace constar que [PENDIENTE: monto actual, atrasos o necesidad de revisión].", { label: "Aceptarla con precisiones" }),
      ],
      hints: ["La demanda informa una cuota ya fijada en otro proceso. Comprueba el monto actual y si hay atrasos; un aumento se discute en el proceso alimentario."],
    }),
  },
  {
    topic: "Responsabilidad parental",
    rx: /\bpatria\s+potestad|responsabilidad\s+parental\b/,
    build: () => ({
      stance: "neutral",
      options: [
        allano("Me allano a que el ejercicio de la responsabilidad parental sea compartido por ambos progenitores.", { recommended: true }),
        opongo("Me opongo: [PENDIENTE: razones por las que el ejercicio compartido no conviene al interés superior de la persona menor de edad].", { when: "Si hay motivos graves (por ejemplo, violencia)." }),
      ],
      hints: [],
    }),
  },
  {
    topic: "Guarda, crianza y educación",
    rx: /\bguarda\b/,
    build: ({ f, ctx }) => {
      const toMother = /guarda\b[^.]{0,80}\b(?:la\s+madre|la\s+demandada|la\s+progenitora)/.test(f);
      const toFather = /guarda\b[^.]{0,80}\b(?:el\s+padre|el\s+actor|el\s+suscrito|el\s+progenitor)/.test(f);
      const ours = (toMother && ctx.female) || (toFather && !ctx.female);
      return {
        stance: ours ? "favorable" : toMother || toFather ? "desfavorable" : "revisar",
        options: ours
          ? [
              allano("Me allano a que la guarda de la persona menor de edad la conserve mi representada y a que la crianza y educación sean compartidas.".replace("mi representada", ctx.rep), { recommended: true }),
              parcial("Me allano a que la guarda la conserve mi representada; en cuanto a la crianza y educación, [PENDIENTE: condiciones].".replace("mi representada", ctx.rep), { label: "Allanarse con condiciones" }),
            ]
          : [opongo(`Me opongo: la guarda debe corresponder a ${ctx.rep}. [PENDIENTE: razones según el interés superior de la persona menor de edad].`, { recommended: true }), allano("Me allano a lo pedido en cuanto a la guarda, crianza y educación.")],
        hints: ["El tribunal decide según el interés superior de la persona menor de edad, las aptitudes de cada progenitor y el acuerdo entre ellos (CF art. 56)."],
      };
    },
  },
  {
    topic: "Régimen de interrelación familiar",
    rx: /\b(?:interrelacion|regimen\s+de\s+visitas|visitas)\b/,
    build: ({ text, ctx }) => {
      const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
      const wordsYear = /\bdos\s+mil\s+veinti(\w+)\b/i.exec(text)?.[1];
      const yearMap: Record<string, number> = { uno: 2021, dos: 2022, tres: 2023, cuatro: 2024, cinco: 2025, seis: 2026, siete: 2027 };
      if (wordsYear && yearMap[fold(wordsYear)]) years.push(yearMap[fold(wordsYear)]);
      const past = years.filter((y) => y < ctx.year);
      return {
        stance: "revisar",
        options: [
          parcial("Acepto el régimen de interrelación familiar propuesto, con las siguientes modificaciones: [PENDIENTE: horarios, lugar de entrega, fechas especiales].", { label: "Aceptarlo con cambios", recommended: true }),
          allano("Me allano al régimen de interrelación familiar propuesto."),
          opongo(`Me opongo al régimen propuesto y propongo el siguiente: [PENDIENTE].`),
        ],
        hints: [
          "Revisa con tu cliente cada horario y la entrega en su casa: son los puntos que más conflictos generan después.",
          ...(past.length ? [`El régimen menciona fechas de ${[...new Set(past)].join(", ")}, ya pasadas: pide que se actualicen.`] : []),
        ],
      };
    },
  },
];

export function analyzeClaim(claim: Item, ctx: ClaimCtx): ClaimPoint {
  const { title, body } = splitTitle(claim.text);
  const f = fold(`${title ?? ""} ${body}`);
  // El título manda («De los alimentos para el menor»), y si no hay título, el texto.
  const head = fold(title ?? "");
  const rule = CLAIM_RULES.find((r) => head && r.rx.test(head)) ?? CLAIM_RULES.find((r) => r.rx.test(f));
  if (!rule) {
    return {
      n: claim.n,
      title,
      topic: title ?? "Pretensión",
      stance: "revisar",
      options: [opongo("Me opongo: [PENDIENTE: motivo].", { recommended: true }), allano("Me allano a esta pretensión."), parcial("Me opongo en parte: [PENDIENTE: qué se acepta y qué no].")],
      hints: [],
    };
  }
  const r = rule.build({ text: body, f, ctx });
  return { n: claim.n, title, topic: rule.topic, ...r };
}

/* ---------------- Prueba ---------------- */

const surnames = (name: string) => {
  const w = name.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, " ").split(/\s+/).filter((x) => x.length > 2);
  return w.length >= 3 ? w.slice(-2).map(fold) : [];
};

export function analyzeEvidence(a: DemandAnalysis, text: string): EvidencePoint[] {
  const actorSurnames = new Set(a.plaintiffs.flatMap(surnames));
  const generic = /sobre\s+todos\s+los\s+hechos/i.test(text);
  const out: EvidencePoint[] = [];
  for (const e of a.evidence) {
    const hints: EvidencePoint["hints"] = [];
    if (e.kind === "testimonial") {
      const name = e.text.split(",")[0].trim();
      const shared = surnames(name).filter((s) => actorSurnames.has(s));
      if (shared.length) {
        hints.push({
          text: `${name} comparte apellido${shared.length > 1 ? "s" : ""} con el actor: posible parentesco.`,
          objection: `Se advierte que la persona testigo ${name} sería familiar del actor, circunstancia que deberá considerarse al valorar su declaración.`,
        });
      }
      if (generic) {
        hints.push({
          text: "Se ofrece «sobre todos los hechos», sin precisar cuáles.",
          objection: "Se solicita que la parte actora indique concretamente sobre qué hechos declarará la persona testigo.",
        });
      }
    }
    if (e.kind === "documental" && /\b(auto|resolucion)\b.*\b(medidas|proteccion)\b/i.test(fold(e.text))) {
      hints.push({ text: "Un auto que da curso a medidas de protección no prueba que los hechos ocurrieran.", objection: "Dicho documento solo acredita la existencia de la solicitud de medidas de protección, no la veracidad de los hechos que en ella se afirman. [PENDIENTE: resultado final de ese proceso]." });
    }
    if (hints.length) out.push({ n: e.n, hints });
  }
  return out;
}

/* ---------------- Todo junto ---------------- */

export function pointByPoint(a: DemandAnalysis, ctx: PointContext): PointByPoint {
  const t = fold(ctx.text);
  const female = /\bdemandada\b|\bcontra\s+la\s+senora\b|\bmi\s+esposa\b/.test(t);
  const parent = /\b(?:nuestr[oa]s?\s+hij[oa]s?|procreamos|el\s+menor|la\s+menor)\b/.test(t);
  const divorceByIncompatibility = /\bdivorcio\b/.test(t) && /incompatibilidad\s+de\s+caracteres/.test(t);
  const marriedOn = /contraj(?:e|imos)\s+matrimonio[^.]{0,120}/.exec(t) ? (findDates(/contraj(?:e|imos)\s+matrimonio[^.]{0,160}/i.exec(ctx.text.normalize("NFC"))?.[0] ?? "")[0] ?? null) : null;
  const filedOn = a.filedOn ?? null;
  const facts = a.facts.map((f) => analyzeFact(f, { divorceByIncompatibility, clientFemale: female, fullText: ctx.text, filedOn, marriedOn }));
  const year = Number(ctx.today.slice(0, 4));
  const claimCtx: ClaimCtx = {
    female,
    parent,
    actorOwns: /\b(?:inscrit[oa]|esta|registrad[oa])\s+a\s+mi\s+nombre\b|\ba\s+mi\s+nombre\b/.test(t),
    rep: female ? "mi representada" : "mi representado",
    year,
    otherCases: [],
  };
  const claims = a.claims.map((c) => {
    const cases = [...c.text.matchAll(/\b\d{2}-\d{6}-\d{4}-[A-Z]{2}\b/g)].map((m) => m[0]);
    return analyzeClaim(c, { ...claimCtx, otherCases: cases });
  });
  const summary: Record<Controversy, number[]> = { sin_controversia: [], confirmar: [], parcial: [], controvertido: [], no_es_hecho: [] };
  for (const f of facts) summary[f.controversy].push(f.n);
  return { facts, claims, evidence: analyzeEvidence(a, ctx.text), summary, clientRole: { female, parent } };
}
