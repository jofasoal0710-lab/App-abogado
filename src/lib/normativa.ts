/**
 * Normativa costarricense: catálogo de las leyes y códigos de uso diario en el despacho.
 *
 * El texto vigente y concordado está en el SCIJ (Sistema Costarricense de Información Jurídica, de la
 * Procuraduría General) y la jurisprudencia en Nexus (Poder Judicial). Ninguno ofrece un servicio para
 * programas, así que la aplicación abre la búsqueda oficial con la referencia copiada («Ley 7764»).
 */
export const SCIJ_URL = "https://pgrweb.go.cr/scij/";
export const NEXUS_URL = "https://nexuspj.poder-judicial.go.cr/";

export const NORM_AREAS = {
  constitucional: "Constitucional",
  civil: "Civil",
  familia: "Familia y niñez",
  laboral: "Laboral",
  penal: "Penal",
  administrativo: "Administrativo y contencioso",
  comercial: "Comercial y concursal",
  notarial: "Notarial y registral",
  tributario: "Tributario",
  transito: "Tránsito",
  otras: "Otras leyes frecuentes",
} as const;
export type NormArea = keyof typeof NORM_AREAS;

export type Norm = {
  key: string;
  name: string;
  /** Número de ley (null para la Constitución). */
  number: string | null;
  area: NormArea;
  /** Palabras con las que también se busca. */
  aka?: string[];
};

export const NORMS: readonly Norm[] = [
  { key: "constitucion", name: "Constitución Política de la República de Costa Rica", number: null, area: "constitucional", aka: ["constitucion"] },
  { key: "ley-7135", name: "Ley de la Jurisdicción Constitucional", number: "7135", area: "constitucional", aka: ["amparo", "habeas corpus", "sala iv"] },

  { key: "ley-63", name: "Código Civil", number: "63", area: "civil" },
  { key: "ley-9342", name: "Código Procesal Civil", number: "9342", area: "civil", aka: ["cpc"] },
  { key: "ley-8624", name: "Ley de Cobro Judicial", number: "8624", area: "civil", aka: ["monitorio", "cobratorio"] },
  { key: "ley-7527", name: "Ley General de Arrendamientos Urbanos y Suburbanos", number: "7527", area: "civil", aka: ["inquilinato", "alquiler"] },
  { key: "ley-8687", name: "Ley de Notificaciones Judiciales", number: "8687", area: "civil" },

  { key: "ley-5476", name: "Código de Familia", number: "5476", area: "familia", aka: ["divorcio", "matrimonio"] },
  { key: "ley-9747", name: "Código Procesal de Familia", number: "9747", area: "familia" },
  { key: "ley-7654", name: "Ley de Pensiones Alimentarias", number: "7654", area: "familia", aka: ["alimentos"] },
  { key: "ley-7586", name: "Ley contra la Violencia Doméstica", number: "7586", area: "familia" },
  { key: "ley-7739", name: "Código de la Niñez y la Adolescencia", number: "7739", area: "familia", aka: ["menores", "pani"] },

  { key: "ley-2", name: "Código de Trabajo", number: "2", area: "laboral", aka: ["despido", "cesantia", "preaviso", "aguinaldo"] },
  { key: "ley-9343", name: "Reforma Procesal Laboral", number: "9343", area: "laboral" },
  { key: "ley-7476", name: "Ley contra el Hostigamiento Sexual en el Empleo y la Docencia", number: "7476", area: "laboral" },

  { key: "ley-4573", name: "Código Penal", number: "4573", area: "penal" },
  { key: "ley-7594", name: "Código Procesal Penal", number: "7594", area: "penal", aka: ["cpp"] },
  { key: "ley-8422", name: "Ley contra la Corrupción y el Enriquecimiento Ilícito en la Función Pública", number: "8422", area: "penal" },

  { key: "ley-6227", name: "Ley General de la Administración Pública", number: "6227", area: "administrativo", aka: ["lgap"] },
  { key: "ley-8508", name: "Código Procesal Contencioso-Administrativo", number: "8508", area: "administrativo", aka: ["cpca", "contencioso"] },
  { key: "ley-9986", name: "Ley General de Contratación Pública", number: "9986", area: "administrativo", aka: ["licitacion"] },
  { key: "ley-9286", name: "Ley de Expropiaciones", number: "9286", area: "administrativo" },
  { key: "ley-8220", name: "Ley de Protección al Ciudadano del Exceso de Requisitos y Trámites Administrativos", number: "8220", area: "administrativo" },

  { key: "ley-3284", name: "Código de Comercio", number: "3284", area: "comercial", aka: ["sociedades", "sociedad anonima", "srl"] },
  { key: "ley-9957", name: "Ley Concursal de Costa Rica", number: "9957", area: "comercial", aka: ["quiebra", "insolvencia"] },
  { key: "ley-7472", name: "Ley de Promoción de la Competencia y Defensa Efectiva del Consumidor", number: "7472", area: "comercial", aka: ["consumidor"] },
  { key: "ley-218", name: "Ley de Asociaciones", number: "218", area: "comercial" },

  { key: "ley-7764", name: "Código Notarial", number: "7764", area: "notarial", aka: ["notario", "notariado", "escritura"] },
  { key: "ley-3883", name: "Ley sobre Inscripción de Documentos en el Registro Público", number: "3883", area: "notarial" },
  { key: "ley-5695", name: "Ley de Creación del Registro Nacional", number: "5695", area: "notarial" },
  { key: "ley-7933", name: "Ley Reguladora de la Propiedad en Condominio", number: "7933", area: "notarial", aka: ["condominio"] },
  { key: "ley-8454", name: "Ley de Certificados, Firmas Digitales y Documentos Electrónicos", number: "8454", area: "notarial", aka: ["firma digital"] },
  { key: "ley-10798", name: "Ley de Presentación Electrónica de los Índices Notariales", number: "10798", area: "notarial", aka: ["index", "indices"] },

  { key: "ley-4755", name: "Código de Normas y Procedimientos Tributarios", number: "4755", area: "tributario", aka: ["cnpt"] },
  { key: "ley-9635", name: "Ley de Fortalecimiento de las Finanzas Públicas (IVA)", number: "9635", area: "tributario", aka: ["iva"] },
  { key: "ley-7092", name: "Ley del Impuesto sobre la Renta", number: "7092", area: "tributario", aka: ["renta"] },

  { key: "ley-9078", name: "Ley de Tránsito por Vías Públicas Terrestres y Seguridad Vial", number: "9078", area: "transito", aka: ["cosevi", "multas", "licencia"] },

  { key: "ley-7333", name: "Ley Orgánica del Poder Judicial", number: "7333", area: "otras" },
  { key: "ley-13", name: "Ley Orgánica del Colegio de Abogados y Abogadas", number: "13", area: "otras" },
  { key: "ley-8968", name: "Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales", number: "8968", area: "otras", aka: ["datos personales"] },
  { key: "ley-8764", name: "Ley General de Migración y Extranjería", number: "8764", area: "otras", aka: ["migracion", "residencia"] },
  { key: "ley-8765", name: "Código Electoral", number: "8765", area: "otras" },
];

const BY_KEY = new Map(NORMS.map((n) => [n.key, n]));
export const getNorm = (key: string | null | undefined) => (key ? BY_KEY.get(key) : undefined);

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Lo que se pega en la búsqueda del SCIJ o de Nexus. */
export function normReference(n: Pick<Norm, "name" | "number">): string {
  return n.number ? `Ley ${n.number}` : n.name;
}

/** «Código Notarial (Ley N.° 7764)». */
export function normLabel(n: Pick<Norm, "name" | "number">): string {
  return n.number ? `${n.name} (Ley N.° ${n.number})` : n.name;
}

/** Busca por nombre, número («7764», «ley 7764») o palabras clave; sin tildes ni mayúsculas. */
export function searchNorms(query: string, area?: string): Norm[] {
  const q = fold(query.trim()).replace(/^ley\s*(n\.?\s*[°º]?\s*)?/, "").trim();
  return NORMS.filter((n) => (!area || n.area === area) && (!q || n.number === q || fold(`${n.name} ${n.number ?? ""} ${(n.aka ?? []).join(" ")}`).includes(q)));
}

/** «1, 2 y 5» → «artículos 1, 2 y 5»; «45» → «artículo 45». */
function articlesPhrase(articles: string): string {
  const a = articles.trim().replace(/^art[ií]culos?\s*/i, "");
  if (!a) return "";
  const many = /[,y\-–]|\bal\b/.test(a);
  return `${many ? "Artículos" : "Artículo"} ${a}`;
}

/** Una cita en prosa: «Artículos 1 y 2 del Código Procesal Civil (Ley N.° 9342).» */
export function citationText(c: { normName: string; normNumber: string | null; articles: string | null; note?: string | null }): string {
  const label = normLabel({ name: c.normName, number: c.normNumber });
  const art = c.articles ? articlesPhrase(c.articles) : "";
  // «del Código…», pero «de la Ley…», «de la Constitución…», «de la Reforma…».
  const prep = /^(la |el )/i.test(c.normName) ? "de" : /^(ley|constituci[oó]n|reforma|convenci[oó]n|directriz)\b/i.test(c.normName) ? "de la" : "del";
  const base = art ? `${art} ${prep} ${label}` : label;
  return `${base}${c.note?.trim() ? `: ${c.note.trim()}` : ""}.`;
}

/** Fundamento de derecho a partir de las citas del expediente (una por línea). */
export function legalBasis(citations: Parameters<typeof citationText>[0][]): string {
  return citations.map(citationText).join("\n");
}
