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
  | { kind: "buscar"; query: string }
  /** Crear, modificar, borrar o consultar algo de la app («quiero ingresar un nuevo cliente»). */
  | { kind: "accion"; verb: ActionVerb; entity: ActionEntity; target: string }
  /** Pregunta jurídica (plazos, recursos, laboral…): base de conocimiento + leyes + cálculo de fechas. */
  | { kind: "consulta"; question: string }
  /** Cálculo de liquidación laboral a partir de la antigüedad y el salario. */
  | { kind: "liquidacion"; question: string }
  /** Honorarios: tarifario del despacho, arancel oficial y timbres («¿cuánto cobro por un traspaso?»). */
  | { kind: "tarifa"; question: string }
  | { kind: "formularios" }
  | { kind: "generar"; template: string | null; ref: string | null }
  | { kind: "escritos"; ref: string | null }
  | { kind: "notaria"; what: "proxima" | "ultimas" | "indice" | "testimonios" }
  | { kind: "normativa"; query: string; ref: string | null; article: string | null };

/** Palabras que identifican cada formulario (de lo más concreto a lo más general). */
const TEMPLATE_WORDS: [RegExp, string][] = [
  [/demanda laboral|laboral/, "demanda-laboral"],
  [/contestacion|contestar/, "contestacion-demanda"],
  [/revocatoria|apelacion|recurso/, "recurso-revocatoria-apelacion"],
  [/medida cautelar|cautelar|embargo|anotacion de demanda/, "medida-cautelar"],
  [/desistimiento|desistir/, "desistimiento"],
  [/medio para notificaciones|senalamiento|notificaciones/, "senalamiento-medio"],
  [/generalisimo/, "poder-generalisimo"],
  [/poder especial|poder/, "poder-especial"],
  [/compraventa|traspaso|vehiculo|carro/, "compraventa-vehiculo"],
  [/declaracion jurada|declaracion/, "declaracion-jurada"],
  [/demanda/, "demanda-ordinaria-civil"],
];

export function matchTemplate(n: string): string | null {
  for (const [re, key] of TEMPLATE_WORDS) if (re.test(n)) return key;
  return null;
}

function expRef(n: string): string | null {
  const exp = /\bexp(?:ediente)?[\s-]*(\d{4})[\s-]*(\d{1,4})\b/.exec(n) ?? /\b(20\d{2})-(\d{1,4})\b/.exec(n);
  return exp ? `EXP-${exp[1]}-${exp[2].padStart(4, "0")}` : null;
}

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

export type ActionVerb = "crear" | "modificar" | "borrar" | "consultar";
export type ActionEntity = "cliente" | "expediente" | "evento" | "factura" | "documento" | "horas" | "nota" | "escritura" | "conocimiento" | "usuario" | "escrito" | "tarifario";

const VERBS: [RegExp, ActionVerb][] = [
  [/\b(crear|crea|creo|nuevo|nueva|agregar|agrega|agrego|anadir|anade|ingresar|ingresa|ingreso|registrar|registra|registro|dar de alta|alta de|abrir un|abrir una|subir|sube|cargar|hacer una?|hago una?|emitir una?)\b/, "crear"],
  [/\b(modificar|modifica|modifico|editar|edita|edito|cambiar|cambia|actualizar|actualiza|corregir|corrige)\b/, "modificar"],
  [/\b(borrar|borra|borro|eliminar|elimina|elimino|quitar|quita|dar de baja|anular)\b/, "borrar"],
  [/\b(ver|veo|encuentro|encontrar|consultar|consulta|mostrar|muestra|muestrame|listar|lista de|buscar|busca)\b/, "consultar"],
];
const ENTITIES: [RegExp, ActionEntity][] = [
  [/\bclientes?\b/, "cliente"],
  [/\bexpedientes?\b|\bcasos?\b|\basuntos?\b/, "expediente"],
  [/\b(eventos?|plazos?|audiencias?|citas?|reunion(es)?|tareas?|vencimientos?)\b/, "evento"],
  [/\bfacturas?\b/, "factura"],
  [/\b(documentos?|archivos?|pdf)\b/, "documento"],
  [/\bhoras\b|\btiempo trabajado\b/, "horas"],
  [/\bnotas?\b/, "nota"],
  [/\bescrituras?\b/, "escritura"],
  [/\b(conocimiento|entrada de conocimiento)\b/, "conocimiento"],
  [/\b(usuarios?|abogad[oa]s? al equipo|miembros? del equipo|persona al equipo)\b/, "usuario"],
  [/\bescritos?\b/, "escrito"],
  [/\b(tarifario|servicios? del tarifario|servicios? del despacho)\b/, "tarifario"],
];

/** «Quiero ingresar un nuevo cliente», «editar el expediente EXP-2026-0001», «borrar el plazo de mañana». */
export function parseAction(text: string): { verb: ActionVerb; entity: ActionEntity; target: string } | null {
  const n = normalize(text);
  const verb = VERBS.find(([re]) => re.test(n))?.[1];
  const ent = ENTITIES.map(([re, e]) => ({ e, i: n.search(re) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i)[0]?.e;
  if (!verb || !ent) return null;
  // Lo que queda después de la entidad es el nombre o la referencia («cliente Ana Pérez»).
  const m = ENTITIES.find(([, e]) => e === ent)![0].exec(n)!;
  const after = n.slice(m.index + m[0].length);
  const target = subject(after, ["nuevo", "nueva", "de", "del", "la", "el", "llamado", "llamada", "que", "se", "llama", "con", "datos", "por", "favor"]);
  return { verb, entity: ent, target };
}

const FEE_TOPIC =
  /\b(cuanto (cobro|cobrar|cobra|cobran|cobramos|se cobra|se cobran|debo cobrar|deberia cobrar|puedo cobrar|cuesta|vale|sale|es el minimo)|honorarios?|arancel|tarifas?|tarifario|hora profesional|timbres?|cobrar por|precio (de|por|del))\b/;

/** Temas jurídicos: la pregunta va a la base de conocimiento y a las leyes, no a los datos del despacho. */
const LEGAL_TOPIC =
  /\b(apela\w*|recurs\w*|revocatoria|casacion|contest\w*|monitorio|sumario|proceso ordinario|prescri\w*|cesantia|preaviso|aguinaldo|vacaciones|feriados?|despid\w*|despido|liquidacion|desahucio|arrendamiento|alquiler|notificad\w*|dias habiles|cuando vence|vence el plazo|cuanto tiempo tengo|cuanto tengo para|plazo para|renuncia\w*|indemniz\w*|jornada|horas extra)\b/;

export function parseIntent(raw: string): Intent {
  const text = raw.slice(0, 300);
  const n = normalize(text);
  if (!n || /^(hola|buenas|ayuda|help|que puedes hacer|que sabes hacer|menu|opciones)\b/.test(n)) return { kind: "ayuda" };

  // Honorarios y tarifas (antes que «escritura» o «hacer»: «¿cuánto cobro por hacer una escritura?»)
  if (FEE_TOPIC.test(n) && !expRef(n) && !/\bfacturas?\b/.test(n) && parseAction(text)?.entity !== "tarifario") return { kind: "tarifa", question: text };

  // Generar o redactar un escrito o escritura («genera una demanda laboral para EXP-2026-0001»)
  if (/\b(genera|generar|genere|redacta|redactar|redacte|prepara|preparar|hacer|haz|crea|crear|nuevo|nueva)\b/.test(n) && (matchTemplate(n) || /\b(escrito|escritura|formulario)\b/.test(n))) {
    return { kind: "generar", template: matchTemplate(n), ref: expRef(n) };
  }
  if (/\b(formularios|machotes|plantillas|modelos)\b/.test(n)) return { kind: "formularios" };
  if (/\bescritos\b/.test(n)) return { kind: "escritos", ref: expRef(n) };
  // Notariado
  if (/\b(proxima|siguiente) escritura\b|\btomo\b|\bfolio\b/.test(n)) return { kind: "notaria", what: "proxima" };
  if (/\bindices?\b|\bquincena\b|\bindex\b/.test(n)) return { kind: "notaria", what: "indice" };
  if (/\btestimonios?\b/.test(n)) return { kind: "notaria", what: "testimonios" };
  if (/\b(escrituras|protocolo|ultima escritura)\b/.test(n)) return { kind: "notaria", what: "ultimas" };

  // Acciones sobre la app: crear, modificar, borrar o consultar (si no es una pregunta jurídica)
  {
    const a = parseAction(text);
    if (a && (a.verb !== "consultar" || /\b(como|donde)\b/.test(n)) && !(a.entity === "escrito" && a.verb === "crear")) return { kind: "accion", ...a };
  }

  // Cálculo de liquidación («cesantía de 3 años y 7 meses con salario de 600 000»)
  if (/\b(liquidacion|cesantia|prestaciones|preaviso|calcul\w*)\b/.test(n) && /\b\d+\s*(anos?|mes(es)?)\b/.test(n) && !/\bplazo\b/.test(n)) return { kind: "liquidacion", question: text };

  // Pregunta jurídica en lenguaje natural (no un artículo concreto ni un expediente)
  if (LEGAL_TOPIC.test(n) && !/\bexpedientes?\b|\bclientes?\b|\bfacturas?\b/.test(n) && !/\bart(iculo|\.)?\s*\d/.test(n) && !/\bley\s*\d/.test(n) && !expRef(n) && !/\b(esta semana|del mes|mis plazos|agenda)\b/.test(n)) return { kind: "consulta", question: text };

  // Normativa: «ley 7764», «código de familia», «normativa del EXP-2026-0001»
  if (/\b(ley|leyes|codigo|codigos|normativa|norma|normas|articulos?|constitucion|reglamento|fundamento)\b/.test(n)) {
    const art = /\bart(?:iculo|\.)?\s*(\d+(?:\s*bis)?)\b/.exec(n);
    const query = subject(text, ["ley", "leyes", "normativa", "norma", "normas", "busca", "buscar", "articulo", "articulos", "sobre", "fundamento", "derecho", "citada", "citadas", "dice", "que"]);
    const cleaned = (art ? query.replace(new RegExp(`\\b${art[1]}\\b`), "") : query).replace(/^n\s*/, "").replace(/\s+/g, " ").trim();
    return { kind: "normativa", query: expRef(n) ? "" : cleaned, ref: expRef(n), article: art ? art[1].replace(/\s+/, " ") : null };
  }

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
