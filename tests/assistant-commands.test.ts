/**
 * Miles de frases para comprobar que el asistente entiende las órdenes (generadas combinando verbos,
 * títulos, fechas, horas, expedientes, personas, prioridades y faltas de ortografía) y que NO confunde
 * preguntas con órdenes. Hoy es miércoles 25/11/2026 en todas las pruebas.
 */
import { describe, expect, it } from "vitest";
import { __test, parseCommand, type ParsedCommand } from "../src/lib/assistant-commands";
import { parseIntent } from "../src/lib/assistant-intent";
import { isWord } from "./helpers/speller";

const T = "2026-11-25";
const P = (s: string, today = T) => parseCommand(s, today, { isWord });
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.,;:]/g, "").replace(/\s+/g, " ").trim();

/** Generador pseudoaleatorio con semilla (las pruebas son siempre las mismas). */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/* ---------- Fechas ---------- */
const FUTURE_DATES: [string, string][] = [
  ["hoy", "2026-11-25"],
  ["mañana", "2026-11-26"],
  ["pasado mañana", "2026-11-27"],
  ["el viernes", "2026-11-27"],
  ["el próximo viernes", "2026-11-27"],
  ["este viernes", "2026-11-27"],
  ["el lunes", "2026-11-30"],
  ["el próximo lunes", "2026-11-30"],
  ["el martes", "2026-12-01"],
  ["el miércoles", "2026-12-02"],
  ["el jueves", "2026-11-26"],
  ["el sábado", "2026-11-28"],
  ["el domingo", "2026-11-29"],
  ["en 3 días", "2026-11-28"],
  ["en tres días", "2026-11-28"],
  ["dentro de 2 semanas", "2026-12-09"],
  ["en una semana", "2026-12-02"],
  ["la próxima semana", "2026-11-30"],
  ["la semana que viene", "2026-11-30"],
  ["a fin de mes", "2026-11-30"],
  ["el 5/12", "2026-12-05"],
  ["el 5/12/2026", "2026-12-05"],
  ["el 15/1", "2027-01-15"],
  ["el 5 de diciembre", "2026-12-05"],
  ["el 1 de enero", "2027-01-01"],
  ["el primero de diciembre", "2026-12-01"],
  ["el 3 de marzo de 2027", "2027-03-03"],
  ["el 2026-12-10", "2026-12-10"],
  ["el 30 de noviembre", "2026-11-30"],
  ["el 24 de diciembre", "2026-12-24"],
];
const PAST_DATES: [string, string][] = [
  ["hoy", "2026-11-25"],
  ["ayer", "2026-11-24"],
  ["anteayer", "2026-11-23"],
  ["el lunes", "2026-11-23"],
  ["el martes", "2026-11-24"],
  ["el viernes", "2026-11-20"],
  ["el viernes pasado", "2026-11-20"],
  ["el 20/11", "2026-11-20"],
  ["el 20 de noviembre", "2026-11-20"],
  ["el 3 de diciembre", "2025-12-03"],
];
const TIMES: [string, string][] = [
  ["a las 3", "15:00"],
  ["a las 3 pm", "15:00"],
  ["a las 3 p.m.", "15:00"],
  ["a las 9", "09:00"],
  ["a las 9 am", "09:00"],
  ["a las 9 de la mañana", "09:00"],
  ["a las 10:30", "10:30"],
  ["a las 15:45", "15:45"],
  ["a las 4 de la tarde", "16:00"],
  ["a las 8 de la noche", "20:00"],
  ["a las 2 y media", "14:30"],
  ["a las 11 y cuarto", "11:15"],
  ["al mediodía", "12:00"],
  ["por la mañana", "09:00"],
  ["por la tarde", "15:00"],
  ["a la 1", "13:00"],
];

describe("fechas, horas y duraciones", () => {
  for (const [e, d] of FUTURE_DATES) it(`fecha «${e}» → ${d}`, () => expect(__test.takeDate(e, T)).toBe(d));
  for (const [e, d] of PAST_DATES) it(`fecha pasada «${e}» → ${d}`, () => expect(__test.takeDate(e, T, true)).toBe(d));
  for (const [e, t] of TIMES) it(`hora «${e}» → ${t}`, () => expect(__test.takeTime(e)).toBe(t));
  it("cambio de año: el 2/1 dicho el 31/12", () => expect(__test.takeDate("el 2/1", "2026-12-31")).toBe("2027-01-02"));
  it("fechas imposibles no se aceptan", () => {
    expect(__test.takeDate("el 31/2", T)).toBeNull();
    expect(__test.takeDate("el 30 de febrero", T)).toBeNull();
  });
  const DUR: [string, number][] = [
    ["2 horas", 120], ["2h", 120], ["1h30", 90], ["1h 30m", 90], ["1:30 h", 90], ["90 minutos", 90], ["45 min", 45], ["media hora", 30], ["hora y media", 90],
    ["una hora y media", 90], ["una hora", 60], ["dos horas", 120], ["tres horas y media", 210], ["2 horas y cuarto", 135], ["1,5 horas", 90], ["2.5 horas", 150],
    ["1 hora y 20 minutos", 80], ["cuarto de hora", 15], ["seis horas", 360], ["10 minutos", 10], ["3h", 180], ["0.5 h", 30],
  ];
  for (const [e, n] of DUR) it(`duración «${e}» → ${n} min`, () => expect(__test.takeMinutes(e)).toBe(n));
});

/* ---------- Tareas: miles de combinaciones ---------- */
const TASK_VERBS = [
  "crea una tarea", "créame una tarea", "añade una tarea", "agrega una tarea", "agrégame una tarea", "nueva tarea", "pon una tarea", "anota una tarea", "apunta una tarea",
  "registra una tarea", "crear tarea", "quiero crear una tarea", "necesito una tarea", "hazme una tarea", "genera una tarea", "recuérdame", "recordarme", "tarea:",
];
const TITLES = [
  "revisar el contrato de arrendamiento", "llamar al perito", "preparar la contestación", "pagar los timbres", "enviar el poder especial al cliente", "presentar el escrito de pruebas",
  "solicitar certificación registral", "revisar la liquidación laboral", "redactar el convenio de divorcio", "confirmar la audiencia con el juzgado", "archivar las copias", "escanear la cédula del cliente",
];
const MATTERS: [string, ParsedCommand extends never ? never : object | null][] = [
  ["", null],
  ["en el EXP-2026-0001", { kind: "numero", number: "EXP-2026-0001" }],
  ["del exp 2026-3", { kind: "numero", number: "EXP-2026-0003" }],
  ["en el expediente 2026-12", { kind: "numero", number: "EXP-2026-0012" }],
  ["en ese expediente", { kind: "contexto" }],
  ["en el mismo caso", { kind: "contexto" }],
];
const ASSIGNEES: [string, string | null][] = [
  ["", null],
  ["asignada a Lucía", "Lucía"],
  ["para Marcos", "Marcos"],
  ["para mí", "@yo"],
  ["asígnasela a Elena", "Elena"],
];
const PRIORITIES: [string, string | null][] = [
  ["", null],
  ["urgente", "urgente"],
  ["con prioridad alta", "alta"],
  ["importante", "alta"],
  ["de baja prioridad", "baja"],
];

type TaskCase = { text: string; title: string; date: string; time: string | null; matter: object | null; assignee: string | null; priority: string | null };
function taskCases(): TaskCase[] {
  const r = rng(42);
  const pick = <X,>(a: X[]) => a[Math.floor(r() * a.length)];
  const out: TaskCase[] = [];
  for (const verb of TASK_VERBS)
    for (const title of TITLES)
      for (let k = 0; k < 14; k++) {
        const [dTxt, date] = pick(FUTURE_DATES);
        const [tTxt, time] = r() < 0.35 ? pick(TIMES.filter(([e]) => e.startsWith("a las"))) : ["", null];
        const [mTxt, matter] = pick(MATTERS);
        const [aTxt, assignee] = pick(ASSIGNEES);
        const [pTxt, priority] = pick(PRIORITIES);
        const extras = [aTxt, pTxt, mTxt].filter(Boolean).join(" ");
        const colonStyle = verb.endsWith(":") || r() < 0.5;
        const text = colonStyle
          ? `${verb.replace(/:$/, "")} ${pTxt} ${aTxt} ${mTxt} para ${dTxt} ${tTxt}: ${title}`
          : `${verb} ${title} ${extras} ${dTxt} ${tTxt}`;
        out.push({ text: text.replace(/\s+/g, " ").trim(), title, date, time, matter, assignee, priority: priority });
      }
  return out;
}

describe("tareas (generadas)", () => {
  const cases = taskCases();
  it(`hay muchas combinaciones (${cases.length})`, () => expect(cases.length).toBeGreaterThan(3000));
  it.each(cases.map((c) => [c.text, c] as const))("«%s»", (_t, c) => {
    const r = P(c.text);
    expect(r?.type).toBe("tarea");
    if (r?.type !== "tarea") return;
    expect(fold(r.title)).toBe(fold(c.title));
    expect(r.date).toBe(c.date);
    expect(r.time).toBe(c.time);
    expect(r.matter).toEqual(c.matter);
    expect(r.assignee).toBe(c.assignee);
    expect(r.priority).toBe(c.priority);
  });
});

/* ---------- Audiencias, reuniones y plazos ---------- */
const EVENT_KINDS: [string, "audiencia" | "reunion" | "plazo", string][] = [
  ["una audiencia preliminar", "audiencia", "audiencia preliminar"],
  ["una audiencia de juicio", "audiencia", "audiencia de juicio"],
  ["una audiencia", "audiencia", "audiencia"],
  ["una reunión con el cliente", "reunion", "reunion con el cliente"],
  ["una cita con el perito", "reunion", "reunion con el perito"],
  ["una reunión", "reunion", "reunion"],
  ["un plazo para contestar la demanda", "plazo", "plazo contestar la demanda"],
  ["un plazo para apelar", "plazo", "plazo apelar"],
  ["un vencimiento para presentar pruebas", "plazo", "plazo presentar pruebas"],
];
const EVENT_VERBS = ["agenda", "agéndame", "programa", "crea", "añade", "pon", "anota", "registra", "apunta", "nueva", "tengo"];

describe("audiencias, reuniones y plazos (generados)", () => {
  const r = rng(7);
  const cases: { text: string; kind: string; title: string; date: string; time: string | null; matter: object | null }[] = [];
  for (const v of EVENT_VERBS)
    for (const [k, kind, title] of EVENT_KINDS)
      for (let i = 0; i < 9; i++) {
        const [dTxt, date] = FUTURE_DATES[Math.floor(r() * FUTURE_DATES.length)];
        const [tTxt, time] = r() < 0.6 ? TIMES[Math.floor(r() * 12)] : ["", null];
        const [mTxt, matter] = MATTERS[Math.floor(r() * MATTERS.length)];
        const verb = v === "nueva" ? "nueva" : v;
        const obj = v === "nueva" ? k.replace(/^una? /, "") : k;
        cases.push({ text: `${verb} ${obj} ${dTxt} ${tTxt} ${mTxt}`.replace(/\s+/g, " ").trim(), kind, title, date, time, matter });
      }
  it(`combinaciones: ${cases.length}`, () => expect(cases.length).toBeGreaterThan(800));
  it.each(cases.map((c) => [c.text, c] as const))("«%s»", (_t, c) => {
    const p = P(c.text);
    expect(p?.type).toBe("evento");
    if (p?.type !== "evento") return;
    expect(p.kind).toBe(c.kind);
    expect(fold(p.title)).toBe(fold(c.title));
    expect(p.date).toBe(c.date);
    expect(p.time).toBe(c.time);
    expect(p.matter).toEqual(c.matter);
  });
});

/* ---------- Horas ---------- */
const HOUR_VERBS = ["registra", "regístrame", "anota", "apunta", "carga", "imputa", "pon", "agrega", "añade", "suma", "trabajé", "dediqué", "estuve"];
const DURATIONS: [string, number][] = [["2 horas", 120], ["1h30", 90], ["media hora", 30], ["hora y media", 90], ["45 minutos", 45], ["3 horas y media", 210], ["1,5 horas", 90], ["una hora", 60], ["dos horas", 120], ["4h", 240]];
const WORK = ["redacción de la demanda", "revisión de prueba documental", "reunión con el cliente", "estudio del expediente", "llamadas al juzgado", "preparación de la audiencia"];

describe("registrar horas (generadas)", () => {
  const r = rng(3);
  const cases: { text: string; minutes: number; date: string | null; matter: object | null; description: string }[] = [];
  for (const v of HOUR_VERBS)
    for (const [dur, minutes] of DURATIONS)
      for (let i = 0; i < 6; i++) {
        const [mTxt, matter] = MATTERS.slice(1)[Math.floor(r() * (MATTERS.length - 1))];
        const [dTxt, date] = r() < 0.5 ? PAST_DATES[Math.floor(r() * PAST_DATES.length)] : ["", null];
        const work = WORK[Math.floor(r() * WORK.length)];
        const text = r() < 0.6 ? `${v} ${dur} ${mTxt} ${dTxt}: ${work}` : `${v} ${dur} ${dTxt} ${mTxt}`;
        cases.push({ text: text.replace(/\s+/g, " ").replace(/ :/, ":").trim(), minutes, date, matter, description: text.includes(":") ? work : "" });
      }
  it(`combinaciones: ${cases.length}`, () => expect(cases.length).toBeGreaterThan(700));
  it.each(cases.map((c) => [c.text, c] as const))("«%s»", (_t, c) => {
    const p = P(c.text);
    expect(p?.type).toBe("horas");
    if (p?.type !== "horas") return;
    expect(p.minutes).toBe(c.minutes);
    expect(p.date).toBe(c.date);
    expect(p.matter).toEqual(c.matter);
    expect(fold(p.description)).toBe(fold(c.description));
  });
  it("no facturables", () => {
    const p = P("registra 2 horas no facturables en el EXP-2026-0001: llamada");
    expect(p).toMatchObject({ type: "horas", minutes: 120, billable: false });
  });
});

/* ---------- Notas, completar, estado, cronómetro ---------- */
describe("notas", () => {
  const verbs = ["añade una nota", "agrega una nota", "crea una nota", "pon una nota", "anota una nota", "deja una nota", "escribe una nota", "guarda una nota", "nueva nota"];
  const bodies = ["El cliente llamó para preguntar por la audiencia", "Se presentó el escrito en ventanilla", "Pendiente de pago de timbres", "La contraparte propuso conciliar"];
  for (const v of verbs)
    for (const [mTxt, matter] of MATTERS.slice(1))
      for (const b of bodies)
        it(`«${v} ${mTxt}: ${b}»`, () => {
          expect(P(`${v} ${mTxt}: ${b}`)).toEqual({ type: "nota", matter, body: b });
        });
});

describe("completar tareas", () => {
  const forms = [
    "marca como hecha la tarea {t}", "marca como completada la tarea {t}", "pon como terminada la tarea {t}", "da por hecha la tarea {t}", "completa la tarea {t}",
    "termina la tarea {t}", "ya hice la tarea {t}", "terminé la tarea {t}", "completé {t}", "marca la tarea {t} como hecha",
  ];
  for (const f of forms)
    for (const t of TITLES.slice(0, 8))
      it(`«${f.replace("{t}", t)}»`, () => {
        const p = P(f.replace("{t}", t));
        expect(p?.type).toBe("completar");
        if (p?.type === "completar") expect(fold(p.what)).toBe(fold(t));
      });
});

describe("estado del expediente", () => {
  const forms: [string, string][] = [
    ["pasa el {m} a en espera", "en_espera"], ["pon el {m} en espera", "en_espera"], ["cambia el estado del {m} a en curso", "en_curso"], ["marca el {m} como en curso", "en_curso"],
    ["cierra el {m}", "cerrado"], ["archiva el {m}", "archivado"], ["reabre el {m}", "abierto"], ["pasa el {m} a cerrado", "cerrado"], ["deja el {m} en espera", "en_espera"], ["mueve el {m} a archivado", "archivado"],
  ];
  const ms: [string, object][] = [["EXP-2026-0001", { kind: "numero", number: "EXP-2026-0001" }], ["expediente 2026-7", { kind: "numero", number: "EXP-2026-0007" }], ["exp 2026-12", { kind: "numero", number: "EXP-2026-0012" }]];
  for (const [f, st] of forms)
    for (const [mt, matter] of ms)
      it(`«${f.replace("{m}", mt)}»`, () => expect(P(f.replace("{m}", mt))).toEqual({ type: "estado", matter, status: st }));
});

describe("cronómetro", () => {
  const ops: [string, string][] = [
    ["inicia el cronómetro", "iniciar"], ["arranca el cronómetro", "iniciar"], ["empieza el cronómetro", "iniciar"], ["pon el cronómetro", "iniciar"], ["activa el cronómetro", "iniciar"],
    ["pausa el cronómetro", "pausar"], ["reanuda el cronómetro", "reanudar"], ["continúa el cronómetro", "reanudar"], ["detén el cronómetro", "detener"], ["para el cronómetro", "detener"],
    ["termina el cronómetro", "detener"], ["apaga el cronómetro", "detener"], ["descarta el cronómetro", "descartar"], ["cancela el cronómetro", "descartar"], ["¿cómo va el cronómetro?", "ver"],
  ];
  for (const [txt, op] of ops) {
    it(`«${txt}»`, () => expect(P(txt)).toMatchObject({ type: "cronometro", op }));
    it(`«${txt} en el EXP-2026-0004»`, () => {
      if (op === "ver") return;
      expect(P(`${txt} en el EXP-2026-0004`)).toMatchObject({ type: "cronometro", op, matter: { kind: "numero", number: "EXP-2026-0004" } });
    });
  }
  it("al detener, la descripción del trabajo", () => expect(P("detén el cronómetro: revisión del expediente")).toMatchObject({ op: "detener", description: "Revisión del expediente" }));
  it("empiezo a trabajar en…", () => expect(P("empiezo a trabajar en el EXP-2026-0002")).toMatchObject({ type: "cronometro", op: "iniciar", matter: { kind: "numero", number: "EXP-2026-0002" } }));
});

describe("consultas sobre lo propio", () => {
  const tareas: [string, string][] = [["¿qué tareas tengo?", "todas"], ["mis tareas", "todas"], ["¿qué tareas tengo hoy?", "hoy"], ["tareas de hoy", "hoy"], ["mis tareas vencidas", "vencidas"], ["¿qué me toca?", "todas"], ["tareas atrasadas", "vencidas"], ["mis pendientes", "todas"]];
  for (const [q, scope] of tareas) it(`«${q}»`, () => expect(P(q)).toEqual({ type: "mis_tareas", scope }));
  const horas: [string, string][] = [["¿cuántas horas llevo hoy?", "hoy"], ["¿cuántas horas llevo esta semana?", "semana"], ["mis horas del mes", "mes"], ["horas registradas hoy", "hoy"], ["¿cuánto tiempo llevo este mes?", "mes"]];
  for (const [q, period] of horas) it(`«${q}»`, () => expect(P(q)).toEqual({ type: "mis_horas", period }));
});

/* ---------- Faltas de ortografía ---------- */
function typo(word: string, r: () => number): string {
  const i = 1 + Math.floor(r() * (word.length - 2));
  const k = Math.floor(r() * 3);
  if (k === 0) return word.slice(0, i) + word.slice(i + 1); // falta una letra
  if (k === 1) return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2); // dos letras cambiadas
  return word.slice(0, i) + word[i] + word.slice(i); // letra repetida
}
describe("con faltas de ortografía", () => {
  const r = rng(99);
  const base: [string, string, string][] = [
    ["crea una {tarea} para mañana: llamar al perito", "tarea", "tarea"],
    ["{registra} 2 horas en el EXP-2026-0001: estudio", "registra", "horas"],
    ["agenda una {audiencia} el lunes a las 9", "audiencia", "evento"],
    ["inicia el {cronometro} en el EXP-2026-0001", "cronometro", "cronometro"],
    ["{recuerdame} pagar los timbres el viernes", "recuerdame", "tarea"],
    ["agenda una {reunion} con el cliente mañana", "reunion", "evento"],
    ["crea una tarea para {manana}: revisar escritura", "manana", "tarea"],
  ];
  const cases: [string, string][] = [];
  for (const [tpl, w, type] of base)
    for (let i = 0; i < 60; i++) {
      const t = typo(w, r);
      if (t === w || isWord(t)) continue; // una «falta» que es otra palabra válida no es una falta
      cases.push([tpl.replace(`{${w}}`, t), type]);
    }
  it(`combinaciones: ${cases.length}`, () => expect(cases.length).toBeGreaterThan(250));
  it.each(cases)("«%s» → %s", (q, type) => expect(P(q)?.type).toBe(type));
});

/* ---------- Lo que NO es una orden ---------- */
const NOT_COMMANDS = [
  "hola", "ayuda", "¿qué puedes hacer?", "resumen", "dame un resumen", "plazos de esta semana", "¿qué tengo hoy en la agenda?", "audiencias del mes", "facturas pendientes", "facturas vencidas",
  "¿cuánto debe Gerson Villalobos?", "estado del expediente EXP-2026-0001", "exp 2026-1", "expedientes activos", "cliente Gerson", "¿cuánto tengo para apelar una sentencia?",
  "¿cuándo prescribe un reclamo laboral?", "artículo 29 del código de trabajo", "me notificaron el 20/11, ¿cuándo vence la apelación?", "liquidación de 3 años y 7 meses con salario de 600 000",
  "¿cuánto cobro por un traspaso?", "genera una demanda laboral para EXP-2026-0001", "formularios", "escritos del EXP-2026-0001", "próxima escritura", "índice notarial",
  "¿cómo creo una tarea?", "¿cómo registro horas?", "¿dónde veo las audiencias?", "¿qué es una audiencia preliminar?", "¿cuál es el plazo para contestar la demanda?",
  "¿cuánto tiempo tengo para contestar una demanda laboral?", "¿cuánto es el preaviso con 2 años de antigüedad?", "plazo para apelar un auto", "¿cuándo vence el plazo de casación?",
  "¿qué dice el artículo 37 del código procesal civil?", "ley de arrendamientos", "¿qué es la cesantía?", "normativa del EXP-2026-0001", "búsqueda Ana Mora",
  "quiero ingresar un nuevo cliente", "editar el expediente EXP-2026-0001", "¿cómo borro una factura?", "¿cuánto debe el cliente?", "tarifas", "arancel de abogados",
  "¿qué es una tarea?", "¿cuántos expedientes tengo?", "¿cuánto tiempo dura un proceso ordinario?", "¿la audiencia se puede suspender?", "¿hay audiencia mañana?",
];
describe("preguntas que no son órdenes", () => {
  for (const q of NOT_COMMANDS) it(`«${q}»`, () => expect(P(q)).toBeNull());
  // Variantes con mayúsculas, signos y espacios.
  for (const q of NOT_COMMANDS.slice(0, 30)) {
    it(`«${q.toUpperCase()}»`, () => expect(P(q.toUpperCase())).toBeNull());
    it(`«  ${q}?? »`, () => expect(P(`  ${q}?? `)).toBeNull());
  }
  it("las preguntas siguen yendo al asistente de siempre", () => {
    expect(parseIntent("plazos de esta semana").kind).toBe("plazos");
    expect(parseIntent("¿cuánto tengo para apelar una sentencia?").kind).toBe("consulta");
  });
});
