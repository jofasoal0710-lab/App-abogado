/**
 * Plantillas de proceso: al aplicarlas a un expediente crean de una vez el plazo legal y las tareas de
 * preparación. El plazo sale de la tabla verificada del asistente (PROCEDURAL_DEADLINES: días hábiles
 * desde el día siguiente a la notificación, con los feriados de Costa Rica); las tareas internas se
 * colocan unos días hábiles ANTES del vencimiento. Todo se muestra antes de crearlo y se puede corregir.
 */
import { PROCEDURAL_DEADLINES } from "./assistant-reason";
import { addBusinessDaysCR, isBusinessDayCR } from "./cr-holidays";

type DeadlineKey = (typeof PROCEDURAL_DEADLINES)[number]["key"];

export type TemplateStep =
  /** El plazo legal: vence `days` hábiles después de la fecha base. */
  | { type: "plazo"; deadline: DeadlineKey; title: string }
  /** Tarea interna: `before` días hábiles antes del plazo principal (0 = el mismo día). */
  | { type: "tarea"; title: string; before: number };

export type ProcessTemplate = {
  key: string;
  name: string;
  area: "civil" | "familia" | "penal" | "contencioso" | "tributario" | "transito";
  /** Qué fecha se pide al aplicarla. */
  baseLabel: string;
  steps: TemplateStep[];
};

export const PROCESS_TEMPLATES: readonly ProcessTemplate[] = [
  {
    key: "contestar_ordinario",
    name: "Contestar una demanda ordinaria civil",
    area: "civil",
    baseLabel: "Fecha de notificación de la demanda",
    steps: [
      { type: "tarea", title: "Reunión con el cliente: hechos, prueba y testigos", before: 20 },
      { type: "tarea", title: "Revisar excepciones procesales y de fondo", before: 15 },
      { type: "tarea", title: "Borrador de la contestación y ofrecimiento de prueba", before: 7 },
      { type: "tarea", title: "Revisión final y firma de la contestación", before: 2 },
      { type: "plazo", deadline: "ordinario", title: "Vence el plazo para contestar la demanda ordinaria" },
    ],
  },
  {
    key: "contestar_sumario",
    name: "Contestar en un proceso sumario civil",
    area: "civil",
    baseLabel: "Fecha de notificación de la demanda",
    steps: [
      { type: "tarea", title: "Reunir la prueba documental con el cliente", before: 3 },
      { type: "tarea", title: "Borrador y firma de la contestación", before: 1 },
      { type: "plazo", deadline: "sumario", title: "Vence el plazo para contestar en el sumario" },
    ],
  },
  {
    key: "monitorio",
    name: "Proceso monitorio: cumplir u oponerse",
    area: "civil",
    baseLabel: "Fecha de notificación de la resolución intimatoria",
    steps: [
      { type: "tarea", title: "Valorar con el cliente pagar u oponerse (causales de oposición)", before: 3 },
      { type: "tarea", title: "Redactar y firmar la oposición", before: 1 },
      { type: "plazo", deadline: "monitorio", title: "Vence el plazo para cumplir u oponerse en el monitorio" },
    ],
  },
  {
    key: "apelar_sentencia_civil",
    name: "Apelar una sentencia civil",
    area: "civil",
    baseLabel: "Fecha de notificación de la sentencia",
    steps: [
      { type: "tarea", title: "Analizar la sentencia e informar al cliente", before: 3 },
      { type: "tarea", title: "Redactar los agravios de la apelación", before: 1 },
      { type: "plazo", deadline: "apelacion_sentencia", title: "Vence el plazo para apelar la sentencia" },
    ],
  },
  {
    key: "casacion_civil",
    name: "Recurso de casación civil",
    area: "civil",
    baseLabel: "Fecha de notificación de la sentencia",
    steps: [
      { type: "tarea", title: "Valorar la admisibilidad y los motivos de casación", before: 10 },
      { type: "tarea", title: "Borrador del recurso de casación", before: 5 },
      { type: "tarea", title: "Revisión final y firma", before: 1 },
      { type: "plazo", deadline: "casacion", title: "Vence el plazo del recurso de casación" },
    ],
  },
  {
    key: "contestar_familia",
    name: "Contestar en un proceso resolutivo de familia",
    area: "familia",
    baseLabel: "Fecha de notificación de la demanda",
    steps: [
      { type: "tarea", title: "Entrevista con el cliente y documentos (constancias, salarios)", before: 5 },
      { type: "tarea", title: "Borrador de la contestación", before: 2 },
      { type: "plazo", deadline: "contestacion_familia", title: "Vence el plazo para contestar la demanda de familia" },
    ],
  },
  {
    key: "contestar_contencioso",
    name: "Contestar una demanda contencioso-administrativa",
    area: "contencioso",
    baseLabel: "Fecha de notificación de la demanda",
    steps: [
      { type: "tarea", title: "Solicitar y revisar el expediente administrativo", before: 20 },
      { type: "tarea", title: "Borrador de la contestación", before: 7 },
      { type: "tarea", title: "Revisión y firma", before: 2 },
      { type: "plazo", deadline: "contestacion_contenciosa", title: "Vence el plazo para contestar (30 días hábiles; 15 si se aportó el expediente certificado)" },
    ],
  },
  {
    key: "apelar_sentencia_penal",
    name: "Apelar una sentencia penal",
    area: "penal",
    baseLabel: "Fecha de notificación de la sentencia",
    steps: [
      { type: "tarea", title: "Estudiar la sentencia íntegra y la grabación del juicio", before: 10 },
      { type: "tarea", title: "Borrador del recurso de apelación", before: 4 },
      { type: "tarea", title: "Revisión final y firma", before: 1 },
      { type: "plazo", deadline: "apelacion_sentencia_penal", title: "Vence el plazo para apelar la sentencia penal" },
    ],
  },
  {
    key: "revocatoria_tributaria",
    name: "Impugnar una liquidación de oficio de Hacienda",
    area: "tributario",
    baseLabel: "Fecha de notificación de la liquidación",
    steps: [
      { type: "tarea", title: "Revisar la liquidación y los papeles de trabajo", before: 20 },
      { type: "tarea", title: "Reunir prueba contable con el cliente", before: 12 },
      { type: "tarea", title: "Borrador de la revocatoria", before: 5 },
      { type: "plazo", deadline: "revocatoria_tributaria", title: "Vence el plazo de la revocatoria contra la liquidación de oficio" },
    ],
  },
  {
    key: "boleta_transito",
    name: "Impugnar una boleta de tránsito",
    area: "transito",
    baseLabel: "Fecha de confección de la boleta",
    steps: [
      { type: "tarea", title: "Reunir fotos, testigos y documentos del vehículo", before: 4 },
      { type: "tarea", title: "Redactar la impugnación ante el Cosevi", before: 1 },
      { type: "plazo", deadline: "boleta_transito", title: "Vence el plazo para impugnar la boleta" },
    ],
  },
];

export const TEMPLATE_AREAS = { civil: "Civil", familia: "Familia", penal: "Penal", contencioso: "Contencioso-administrativo", tributario: "Tributario", transito: "Tránsito" } as const;

export const getTemplate = (key: string) => PROCESS_TEMPLATES.find((t) => t.key === key) ?? null;

/** Retrocede n días hábiles (CR). Con n = 0 devuelve la misma fecha. */
export function subtractBusinessDaysCR(date: string, n: number): string {
  let d = date;
  let count = 0;
  while (count < n) {
    const x = new Date(`${d}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() - 1);
    d = x.toISOString().slice(0, 10);
    if (isBusinessDayCR(d)) count++;
  }
  return d;
}

export type PlannedStep = { index: number; type: "plazo" | "tarea"; title: string; date: string; ref: string | null; note: string | null; past: boolean };

/**
 * Calcula las fechas de cada paso a partir de la fecha base. Las tareas que caerían antes de la fecha
 * base o antes de hoy se mueven a hoy (o a la base) y se marcan, para que nadie se fíe de una fecha pasada.
 */
export function planTemplate(t: ProcessTemplate, base: string, today: string): PlannedStep[] {
  const main = t.steps.find((s) => s.type === "plazo") as Extract<TemplateStep, { type: "plazo" }> | undefined;
  const def = main ? PROCEDURAL_DEADLINES.find((d) => d.key === main.deadline)! : null;
  const due = def ? addBusinessDaysCR(base, def.days) : base;
  const floor = base > today ? base : today;
  return t.steps.map((s, index) => {
    if (s.type === "plazo") {
      const d = PROCEDURAL_DEADLINES.find((x) => x.key === s.deadline)!;
      const date = addBusinessDaysCR(base, d.days);
      return { index, type: "plazo", title: s.title, date, ref: d.ref, note: `${d.days} días hábiles desde el día siguiente a la fecha base (${d.ref}).`, past: date < today };
    }
    const raw = subtractBusinessDaysCR(due, s.before);
    const moved = raw < floor;
    return { index, type: "tarea", title: s.title, date: moved ? floor : raw, ref: null, note: moved ? "La fecha sugerida quedaba antes de hoy o de la fecha base: se propone esta." : `${s.before} días hábiles antes del vencimiento.`, past: false };
  });
}
