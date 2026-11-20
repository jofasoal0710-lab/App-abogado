/**
 * Arancel de Honorarios por Servicios Profesionales de Abogacía y Notariado (Costa Rica).
 *
 * Fuente: Decreto Ejecutivo N° 41457-JP del 17/10/2018, reformado por el N° 41930-JP del 22/05/2019,
 * texto de SINALEVI «versión 4 de 4» (vigente). La reforma del Decreto 43704-JP (2022), que eliminaba
 * los mínimos, fue anulada por el Tribunal Contencioso Administrativo (resolución N° 00958 del
 * 16/02/2024); por eso rigen los montos del texto anterior a esa reforma.
 *
 * Los montos fijos son los del texto del decreto. El art. 112 prevé que el Colegio de Abogados los
 * actualice cada dos años según el IPC (máximo 10 %): esa actualización se ingresa en el tarifario
 * del despacho como «ajuste del arancel» y se aplica a los montos (no a los porcentajes).
 *
 * Todo en céntimos de colón (₡1 = 100), como el resto de la app. Sin dependencias: se usa también
 * en el navegador (ventana de ayuda).
 */

export const ARANCEL_SOURCE = {
  name: "Arancel de honorarios por servicios profesionales de abogacía y notariado",
  decree: "Decreto Ejecutivo N° 41457-JP (reformado por el N° 41930-JP)",
  version: "SINALEVI, versión 4 de 4",
  url: "https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=88156&param2=145178&param3=1",
  note: "La reforma del Decreto 43704-JP (2022) fue anulada por el Tribunal Contencioso Administrativo (res. 00958 del 16/02/2024).",
} as const;

const C = (colones: number) => colones * 100;

type Tier = { upTo: number | null; bp: number }; // bp: puntos básicos (2 % = 200)

/** Art. 16: procesos civiles, comerciales, agrarios, contencioso administrativos y tributarios con cuantía. */
const TIERS_PROCESOS: Tier[] = [
  { upTo: C(16_500_000), bp: 2000 },
  { upTo: C(82_500_000), bp: 1500 },
  { upTo: null, bp: 1000 },
];
/** Art. 74: tarifa general notarial, según la cuantía, valor real o estimación del acto. */
const TIERS_NOTARIAL: Tier[] = [
  { upTo: C(11_000_000), bp: 200 },
  { upTo: C(16_500_000), bp: 150 },
  { upTo: C(33_000_000), bp: 125 },
  { upTo: null, bp: 100 },
];

/** Aplica una tabla escalonada (cada tramo sobre el exceso del anterior). */
export function tiered(baseCents: number, tiers: Tier[]): number {
  let rest = Math.max(0, baseCents);
  let prev = 0;
  let total = 0;
  for (const t of tiers) {
    const span = t.upTo === null ? rest : Math.min(rest, t.upTo - prev);
    total += (span * t.bp) / 10000;
    rest -= span;
    if (t.upTo !== null) prev = t.upTo;
    if (rest <= 0) break;
  }
  return Math.round(total);
}

export const tarifaProcesos = (baseCents: number) => tiered(baseCents, TIERS_PROCESOS);
export const tarifaNotarial = (baseCents: number) => tiered(baseCents, TIERS_NOTARIAL);

/** Timbre del Colegio de Abogados según la cuantía (arts. 107 para procesos y 108 para instrumentos públicos: misma escala). */
export function timbreColegio(baseCents: number, opts: { inestimable?: boolean; proceso?: boolean } = {}): number {
  if (opts.inestimable) return opts.proceso ? C(12_100) : C(275);
  const b = baseCents;
  if (b <= C(250_000)) return 0;
  if (b <= C(1_000_000)) return C(1_100);
  if (b <= C(5_000_000)) return C(2_200);
  if (b <= C(25_000_000)) return C(5_500);
  if (b <= C(50_000_000)) return C(11_000);
  if (b < C(100_000_000)) return C(16_500);
  if (b < C(500_000_000)) return C(27_500);
  return C(55_000);
}

export type ArancelRule =
  | { kind: "minimo"; min: number }
  | { kind: "hora"; min: number }
  | { kind: "tarifa"; table: "procesos" | "notarial"; factor: number; min: number }
  | { kind: "porcentaje"; fromBp: number; toBp: number; min: number };

export type ArancelStage = { name: string; percent: number };

export type ArancelArea = "abogacia" | "laboral" | "familia" | "penal" | "constitucional" | "notariado";
export const ARANCEL_AREAS: Record<ArancelArea, string> = {
  abogacia: "Procesos civiles, comerciales y administrativos",
  laboral: "Laboral",
  familia: "Familia",
  penal: "Penal",
  constitucional: "Constitucional",
  notariado: "Notariado",
};

export type ArancelItem = {
  key: string;
  area: ArancelArea;
  name: string;
  article: string;
  rule: ArancelRule;
  /** Forma de pago por etapas que fija el arancel, salvo convenio escrito. */
  stages?: ArancelStage[];
  /** Qué valor se usa como base (cuantía), si la regla depende de él. */
  base?: string;
  note?: string;
  /** Palabras con las que se busca (además del nombre). */
  words?: string;
};

const THIRDS_CIVIL: ArancelStage[] = [
  { name: "Presentación de la demanda o contestación", percent: 33.34 },
  { name: "Conclusión de la fase demostrativa", percent: 33.33 },
  { name: "Sentencia", percent: 33.33 },
];
const HALVES = (a: string, b: string): ArancelStage[] => [
  { name: a, percent: 50 },
  { name: b, percent: 50 },
];

export const ARANCEL: ArancelItem[] = [
  // Generales
  { key: "hora", area: "abogacia", name: "Hora profesional (abogacía)", article: "art. 7", rule: { kind: "hora", min: C(90_750) }, words: "hora tarifa por hora horas", note: "Se puede cobrar por horas si el total no es inferior al mínimo del arancel para el asunto." },
  { key: "hora_notarial", area: "notariado", name: "Hora en servicios notariales", article: "art. 63", rule: { kind: "hora", min: C(90_750) }, words: "hora notario", note: "Solo para actos no previstos en el arancel o trámites y desplazamientos extraordinarios." },
  // Procesos
  { key: "proceso_cuantia", area: "abogacia", name: "Proceso ordinario, abreviado o sumario con cuantía (civil, comercial, contencioso, agrario, tributario)", article: "arts. 16 y 18", rule: { kind: "tarifa", table: "procesos", factor: 1, min: 0 }, stages: THIRDS_CIVIL, base: "Cuantía del proceso", words: "demanda civil ordinario abreviado sumario cobro judicial contencioso", note: "Incluye recursos ordinarios e incidentes hasta segunda instancia (art. 20). Si termina por conciliación, mediación o transacción: 50 % (art. 17)." },
  { key: "proceso_inestimable", area: "abogacia", name: "Proceso de cuantía inestimable", article: "art. 19", rule: { kind: "minimo", min: C(242_000) }, words: "inestimable" },
  { key: "casacion", area: "abogacia", name: "Recurso de casación", article: "art. 20", rule: { kind: "minimo", min: C(605_000) }, words: "casacion sala primera" },
  { key: "monitorio", area: "abogacia", name: "Proceso monitorio", article: "art. 21", rule: { kind: "tarifa", table: "procesos", factor: 0.5, min: C(60_500) }, stages: [{ name: "Presentación de la demanda o contestación", percent: 50 }, { name: "Sentencia firme", percent: 25 }, { name: "Remate o aprobación de la liquidación", percent: 25 }], base: "Monto reclamado", words: "monitorio cobro pagare letra" },
  { key: "ejecucion", area: "abogacia", name: "Proceso de ejecución (hipotecaria, prendaria)", article: "art. 22", rule: { kind: "tarifa", table: "procesos", factor: 0.5, min: C(60_500) }, stages: HALVES("Presentación de la demanda o contestación", "Remate en firme o arreglo"), base: "Monto de la ejecución", words: "ejecucion hipotecaria prendaria remate" },
  { key: "desahucio", area: "abogacia", name: "Desahucio", article: "art. 24", rule: { kind: "tarifa", table: "procesos", factor: 1, min: C(181_500) }, stages: HALVES("Presentación de la demanda", "Sentencia firme o desocupación"), base: "Cuantía (art. 17 inc. 6 CPC)", words: "desahucio arrendamiento alquiler inquilino" },
  { key: "medida_cautelar", area: "abogacia", name: "Medida cautelar", article: "art. 25", rule: { kind: "minimo", min: C(121_000) }, words: "cautelar embargo" },
  { key: "sucesorio", area: "abogacia", name: "Sucesorio", article: "art. 28", rule: { kind: "tarifa", table: "procesos", factor: 0.5, min: C(242_000) }, base: "Valor de todos los bienes", words: "sucesion sucesorio herencia", note: "Independiente de los honorarios de la escritura de adjudicación." },
  { key: "administrativo", area: "abogacia", name: "Trámite en sede administrativa", article: "art. 11", rule: { kind: "tarifa", table: "procesos", factor: 0.5, min: C(242_000) }, base: "Monto estimado del asunto", words: "administrativo municipalidad ministerio", note: "El mínimo de ₡242.000 rige para asuntos no estimables." },
  { key: "otros_procesos", area: "abogacia", name: "Otros procesos o diligencias no previstos", article: "art. 27", rule: { kind: "tarifa", table: "procesos", factor: 0.5, min: C(121_000) }, base: "Cuantía", words: "otros diligencia", note: "Se paga el 100 % con la presentación." },
  { key: "cobro_extrajudicial", area: "abogacia", name: "Cobro extrajudicial con resultado", article: "art. 54", rule: { kind: "porcentaje", fromBp: 500, toBp: 1000, min: C(30_250) }, base: "Monto recuperado", words: "cobro extrajudicial aviso de cobro", note: "5 % del monto con resultado, 10 % si es mediante arreglo de pago; ₡30.250 por aviso sin resultado." },
  { key: "contrato_privado", area: "abogacia", name: "Redacción de contrato privado", article: "art. 57", rule: { kind: "tarifa", table: "procesos", factor: 0.5, min: C(60_500) }, base: "Valor del contrato", words: "contrato privado redaccion" },
  { key: "acta", area: "abogacia", name: "Redacción de actas", article: "art. 53", rule: { kind: "minimo", min: C(60_500) }, words: "acta asamblea", note: "₡90.750 si surte efectos registrales." },
  { key: "autenticacion", area: "abogacia", name: "Autenticación de firma", article: "arts. 59 y 92", rule: { kind: "minimo", min: C(18_150) }, words: "autenticacion firma autenticar" },
  // Laboral
  { key: "laboral_ordinario", area: "laboral", name: "Proceso ordinario laboral", article: "art. 32 a)", rule: { kind: "porcentaje", fromBp: 2500, toBp: 3000, min: C(121_000) }, base: "Importe de la condenatoria (o absolutoria)", words: "laboral despido prestaciones trabajador patrono" },
  { key: "riesgos_trabajo", area: "laboral", name: "Riesgos del trabajo", article: "art. 32 b)", rule: { kind: "porcentaje", fromBp: 2000, toBp: 2500, min: C(121_000) }, base: "Monto de la indemnización", words: "riesgo del trabajo accidente laboral ins" },
  { key: "laboral_otros", area: "laboral", name: "Otros procesos laborales", article: "art. 36", rule: { kind: "minimo", min: C(121_000) }, words: "laboral" },
  // Familia
  { key: "divorcio_mutuo", area: "familia", name: "Divorcio o separación por mutuo acuerdo (proceso judicial)", article: "art. 48", rule: { kind: "minimo", min: C(181_500) }, stages: HALVES("Presentación de la homologación", "Inscripción de la ejecutoria"), words: "divorcio mutuo acuerdo separacion", note: "Aparte de los honorarios notariales del convenio (art. 94)." },
  { key: "familia_proceso", area: "familia", name: "Divorcio, unión de hecho, filiación, patria potestad o adopción (sin gananciales)", article: "art. 49", rule: { kind: "minimo", min: C(181_500) }, stages: HALVES("Presentación del proceso", "Sentencia"), words: "divorcio union de hecho filiacion adopcion patria potestad", note: "Con disputa de gananciales: mínimo ₡242.000." },
  { key: "pension", area: "familia", name: "Pensión alimentaria (proceso o incidente)", article: "art. 50", rule: { kind: "minimo", min: C(181_500) }, stages: HALVES("Presentación", "Sentencia"), words: "pension alimentaria alimentos" },
  // Penal
  { key: "penal_unipersonal", area: "penal", name: "Defensa penal ante Tribunal Unipersonal", article: "art. 38", rule: { kind: "minimo", min: C(484_000) }, stages: [{ name: "Etapa de investigación", percent: 33.34 }, { name: "Audiencia preliminar", percent: 33.33 }, { name: "Juicio oral", percent: 33.33 }], words: "penal defensa delito unipersonal", note: "Abreviado o medida alterna: 75 % del total." },
  { key: "querella", area: "penal", name: "Querella en delitos de acción privada", article: "art. 43", rule: { kind: "minimo", min: C(363_000) }, words: "querella injurias calumnias difamacion" },
  // Constitucional
  { key: "amparo", area: "constitucional", name: "Recurso de amparo", article: "art. 46", rule: { kind: "minimo", min: C(181_500) }, words: "amparo sala constitucional", note: "Se paga completo con la presentación." },
  // Notariado
  { key: "notarial_general", area: "notariado", name: "Escritura con cuantía (tarifa general notarial)", article: "art. 74", rule: { kind: "tarifa", table: "notarial", factor: 1, min: C(60_500) }, base: "Cuantía, valor real o estimación del acto", words: "escritura notarial compraventa hipoteca donacion" },
  { key: "traspaso_inmueble", area: "notariado", name: "Compraventa o traspaso de inmueble", article: "art. 74", rule: { kind: "tarifa", table: "notarial", factor: 1, min: C(60_500) }, base: "Precio o valor real del inmueble", words: "traspaso compraventa inmueble finca lote casa propiedad" },
  { key: "traspaso_vehiculo", area: "notariado", name: "Traspaso de vehículo, buque o aeronave", article: "art. 82", rule: { kind: "tarifa", table: "notarial", factor: 1, min: C(60_500) }, base: "El mayor entre valor fiscal y valor real", words: "traspaso vehiculo carro moto auto buque aeronave" },
  { key: "hipoteca", area: "notariado", name: "Hipoteca o prenda (constitución)", article: "art. 74", rule: { kind: "tarifa", table: "notarial", factor: 1, min: C(60_500) }, base: "Monto garantizado", words: "hipoteca prenda credito garantia" },
  { key: "cancelacion_hipoteca", area: "notariado", name: "Cancelación de hipoteca o prenda", article: "art. 75 b)", rule: { kind: "tarifa", table: "notarial", factor: 0.5, min: C(60_500) }, base: "Monto cancelado", words: "cancelacion hipoteca prenda" },
  { key: "segregacion", area: "notariado", name: "Segregación en cabeza propia o rectificación de medida", article: "art. 76", rule: { kind: "tarifa", table: "notarial", factor: 0.25, min: C(60_500) }, base: "Valor de cada finca", words: "segregacion rectificacion medida lote" },
  { key: "arrendamiento_escritura", area: "notariado", name: "Arrendamiento en escritura pública", article: "art. 78", rule: { kind: "tarifa", table: "notarial", factor: 1, min: C(60_500) }, base: "Alquiler de un año", words: "arrendamiento alquiler escritura" },
  { key: "sociedad", area: "notariado", name: "Constitución de sociedad, asociación, fundación o cooperativa", article: "art. 95 a)", rule: { kind: "minimo", min: C(181_500) }, words: "sociedad anonima limitada constitucion asociacion fundacion empresa" },
  { key: "sociedad_modificacion", area: "notariado", name: "Modificación de estatutos o nombramientos", article: "art. 95 e)", rule: { kind: "minimo", min: C(90_750) }, words: "modificacion estatutos nombramiento junta directiva sociedad" },
  { key: "poder", area: "notariado", name: "Poder (constitución, sustitución, revocatoria)", article: "art. 96", rule: { kind: "minimo", min: C(90_750) }, words: "poder generalisimo especial judicial" },
  { key: "testamento", area: "notariado", name: "Testamento", article: "art. 97", rule: { kind: "minimo", min: C(121_000) }, words: "testamento" },
  { key: "matrimonio", area: "notariado", name: "Matrimonio civil", article: "art. 94", rule: { kind: "minimo", min: C(121_000) }, words: "matrimonio boda" },
  { key: "capitulaciones", area: "notariado", name: "Capitulaciones matrimoniales", article: "art. 94", rule: { kind: "tarifa", table: "notarial", factor: 1, min: C(121_000) }, base: "Valor de los bienes", words: "capitulaciones" },
  { key: "convenio_divorcio", area: "notariado", name: "Convenio de divorcio o separación sin gananciales", article: "art. 94", rule: { kind: "minimo", min: C(121_000) }, words: "convenio divorcio separacion", note: "Con gananciales: 50 % de la tarifa notarial sobre los bienes, mínimo ₡181.500." },
  { key: "acta_notarial", area: "notariado", name: "Acta notarial", article: "art. 89", rule: { kind: "minimo", min: C(60_500) }, words: "acta notarial", note: "₡121.000 si se hace fuera de la oficina." },
  { key: "certificacion", area: "notariado", name: "Certificación notarial o estudio de registro", article: "arts. 91 y 93", rule: { kind: "minimo", min: C(18_150) }, words: "certificacion estudio de registro personeria" },
  { key: "testimonio", area: "notariado", name: "Ulterior testimonio", article: "art. 90", rule: { kind: "minimo", min: C(30_250) }, words: "testimonio" },
  { key: "fecha_cierta", area: "notariado", name: "Razón de fecha cierta", article: "art. 99", rule: { kind: "minimo", min: C(60_500) }, words: "fecha cierta" },
  { key: "no_previsto_notarial", area: "notariado", name: "Acto notarial no previsto", article: "art. 65", rule: { kind: "minimo", min: C(121_000) }, words: "otro" },
];

export const arancelItem = (key: string | null | undefined) => (key ? ARANCEL.find((i) => i.key === key) ?? null : null);

/** Ajuste del art. 112 (en puntos básicos: 500 = 5 %) sobre los montos fijos. */
const adjust = (cents: number, adjustBp: number) => Math.round((cents * (10000 + adjustBp)) / 10000 / 100) * 100;

export type ArancelResult = {
  /** Honorario mínimo según el arancel (con el ajuste aplicado). Null si hace falta la base y no se dio. */
  minCents: number | null;
  /** Para reglas con rango (laboral): el extremo superior. */
  maxCents?: number;
  /** Por hora (solo reglas «hora»). */
  perHour?: boolean;
  needsBase: boolean;
  explanation: string;
};

/**
 * Colones sin decimales con separador de miles fijo (espacio duro): igual en el servidor y en el
 * navegador (toLocaleString puede variar según el motor y romper la hidratación).
 */
export function crc(cents: number): string {
  const n = Math.round(cents / 100);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${n < 0 ? "-" : ""}₡${s}`;
}
const money = crc;
const pct = (bp: number) => `${String(bp / 100).replace(".", ",")} %`;

/** Calcula el honorario mínimo del arancel para un asunto y, si aplica, su base (cuantía). */
export function arancelMinimum(item: ArancelItem, baseCents: number | null, adjustBp = 0): ArancelResult {
  const r = item.rule;
  if (r.kind === "minimo") return { minCents: adjust(r.min, adjustBp), needsBase: false, explanation: `Mínimo ${money(adjust(r.min, adjustBp))} (${item.article}).` };
  if (r.kind === "hora") return { minCents: adjust(r.min, adjustBp), perHour: true, needsBase: false, explanation: `Mínimo ${money(adjust(r.min, adjustBp))} por hora (${item.article}).` };
  const min = adjust(r.min, adjustBp);
  if (baseCents === null || baseCents <= 0) {
    const what =
      r.kind === "tarifa"
        ? `${r.factor === 1 ? "" : `${r.factor * 100} % de `}la tarifa ${r.table === "procesos" ? "general de procesos (20 %, 15 % y 10 % por tramos)" : "general notarial (2 %, 1,5 %, 1,25 % y 1 % por tramos)"}`
        : `del ${pct(r.fromBp)} al ${pct(r.toBp)}`;
    return { minCents: min || null, needsBase: true, explanation: `${what[0].toUpperCase()}${what.slice(1)} sobre: ${item.base ?? "la cuantía"}${min ? `; mínimo ${money(min)}` : ""} (${item.article}).` };
  }
  if (r.kind === "tarifa") {
    const raw = Math.round((r.table === "procesos" ? tarifaProcesos(baseCents) : tarifaNotarial(baseCents)) * r.factor);
    const value = Math.max(raw, min);
    const how = `${r.factor === 1 ? "Tarifa" : `${r.factor * 100} % de la tarifa`} ${r.table === "procesos" ? "de procesos" : "notarial"} sobre ${money(baseCents)} = ${money(raw)}`;
    return { minCents: value, needsBase: true, explanation: `${how}${raw < min ? `; se aplica el mínimo de ${money(min)}` : ""} (${item.article}).` };
  }
  const lo = Math.max(Math.round((baseCents * r.fromBp) / 10000), min);
  const hi = Math.max(Math.round((baseCents * r.toBp) / 10000), min);
  return { minCents: lo, maxCents: hi, needsBase: true, explanation: `Del ${pct(r.fromBp)} al ${pct(r.toBp)} de ${money(baseCents)}: ${money(lo)} a ${money(hi)}${min ? ` (mínimo ${money(min)})` : ""} (${item.article}).` };
}

/** Reparte un total en etapas (los céntimos sobrantes van a la última, para que sume exacto). */
export function splitStages(totalCents: number, stages: ArancelStage[]): { name: string; amountCents: number }[] {
  if (!stages.length) return [];
  const sum = stages.reduce((s, x) => s + x.percent, 0) || 1;
  const out = stages.map((s) => ({ name: s.name, amountCents: Math.round((totalCents * s.percent) / sum / 100) * 100 }));
  const diff = totalCents - out.reduce((s, x) => s + x.amountCents, 0);
  out[out.length - 1].amountCents += diff;
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Busca en el arancel por palabras («traspaso de carro», «sociedad», «pensión»). */
export function searchArancel(query: string, limit = 5): ArancelItem[] {
  const words = norm(query)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 4 && !["cuanto", "cobro", "cobrar", "cobra", "honorarios", "honorario", "minimo", "minimos", "arancel", "tarifa", "para", "por", "una", "unos", "cuesta", "debo", "puedo", "cobramos"].includes(w));
  if (!words.length) return [];
  const scored = ARANCEL.map((it) => {
    const hay = norm(`${it.name} ${it.words ?? ""}`);
    const score = words.reduce((s, w) => s + (hay.includes(w) ? (norm(it.name).includes(w) ? 2 : 1) : hay.includes(w.slice(0, -1)) ? 1 : 0), 0);
    return { it, score };
  }).filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.it);
}
