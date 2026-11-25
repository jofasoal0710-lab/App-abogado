/**
 * Asistente: órdenes que se pueden EJECUTAR desde el chat («crea una tarea para mañana», «registra 2 horas
 * en el EXP-2026-0001», «detén el cronómetro»). Solo interpreta el texto (puro, sin base de datos ni
 * servicios externos); la ejecución pide confirmación y se valida de nuevo en el servidor (assistant-exec.ts).
 *
 * Cómo «piensa»: el texto se parte en palabras; cada reconocedor (fecha, hora, duración, expediente,
 * persona, prioridad…) marca las palabras que entiende, y lo que queda forma el título o el texto libre.
 */

export type Priority = "baja" | "normal" | "alta" | "urgente";
export type EventKind = "plazo" | "audiencia" | "reunion";
export type MatterStatus = "abierto" | "en_curso" | "en_espera" | "cerrado" | "archivado";
export type MatterRef = { kind: "numero"; number: string } | { kind: "contexto" } | { kind: "texto"; text: string };
export type TimerOp = "iniciar" | "pausar" | "reanudar" | "detener" | "descartar" | "ver";

export type ParsedCommand =
  | { type: "tarea"; title: string; date: string | null; time: string | null; matter: MatterRef | null; assignee: string | null; priority: Priority | null }
  | { type: "evento"; kind: EventKind; title: string; date: string | null; time: string | null; matter: MatterRef | null; assignee: string | null }
  | { type: "horas"; minutes: number | null; date: string | null; matter: MatterRef | null; description: string; billable: boolean | null }
  | { type: "nota"; matter: MatterRef | null; body: string }
  | { type: "completar"; what: string; matter: MatterRef | null }
  | { type: "estado"; matter: MatterRef | null; status: MatterStatus }
  | { type: "cronometro"; op: TimerOp; matter: MatterRef | null; description: string }
  | { type: "mis_tareas"; scope: "hoy" | "semana" | "todas" | "vencidas" }
  | { type: "mis_horas"; period: "hoy" | "semana" | "mes" };

/* ---------------- Palabras: limpieza y corrección de faltas ---------------- */

const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Limpia una palabra: sin tildes, en minúsculas, sin signos (conserva «:» y «/» de horas y fechas). */
function cleanToken(t: string): string {
  let s = strip(t).replace(/(?<!\d),|,(?!\d)/g, "").replace(/[¿?¡!;"«»()[\]{}]/g, "");
  if (/^[ap]\.?m\.?$/.test(s)) return s[0] + "m";
  s = s.replace(/^[.:'-]+/, "").replace(/[.:'-]+$/, "");
  return s;
}

/** Vocabulario de las órdenes: una palabra mal escrita (una letra de más, de menos o cambiada) se corrige. */
const VOCAB = [
  "tarea", "tareas", "pendiente", "pendientes", "recordatorio", "recuerdame", "recordarme", "audiencia", "audiencias", "reunion", "reuniones", "plazo", "plazos",
  "vencimiento", "horas", "minutos", "registra", "registrar", "registrame", "anota", "anotar", "anotame", "apunta", "apuntar", "apuntame", "crea", "crear", "creame",
  "agenda", "agendar", "agendame", "programa", "programar", "programame", "anade", "anadir", "agrega", "agregar", "agregame", "cronometro", "inicia", "iniciar",
  "arranca", "arrancar", "empieza", "empezar", "comienza", "comenzar", "pausa", "pausar", "reanuda", "reanudar", "continua", "continuar", "deten", "detener",
  "detenlo", "parar", "termina", "terminar", "finaliza", "finalizar", "descarta", "descartar", "cancela", "cancelar", "nota", "notas", "expediente", "expedientes",
  "completada", "completa", "completar", "completado", "hecha", "hecho", "terminada", "terminado", "marca", "marcar", "estado", "cierra", "cerrar", "archiva",
  "archivar", "reabre", "reabrir", "manana", "pasado", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo", "proximo", "proxima", "semana",
  "prioridad", "urgente", "importante", "asignada", "asignado", "asigna", "asignar", "asignale", "trabaje", "trabajado", "dedique", "estuve", "enero", "febrero",
  "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "septiembre", "octubre", "noviembre", "diciembre", "facturable", "facturables", "llamada",
  "llamar", "revisar", "presentar", "contestacion", "demanda", "cliente", "mediodia", "cuantas", "llevo", "registradas", "vencidas",
];
const VOCAB_SET = new Set(VOCAB);
/** Palabras comunes que nunca se «corrigen» (son correctas aunque se parezcan a otra del vocabulario). */
const KEEP = new Set(["tarde", "carta", "cartas", "parte", "partes", "pasa", "pasar", "pase", "plata", "marco", "marcos", "nada", "hora", "notar", "notario", "notaria", "nueva", "nuevo", "nuevas", "nuevos", "hecho", "hechos", "lucia", "maria", "elena", "javier", "mario", "andrea", "carlos", "ultima", "ultimo",
  // Términos jurídicos que el diccionario general no siempre trae.
  "registral", "registrales", "procesal", "procesales", "notarial", "notariales", "pericial", "periciales", "cautelar", "cautelares", "registro", "registros", "testimonial"]);

/** Distancia de edición con trasposiciones (Damerau–Levenshtein restringida), cortando al superar `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Corrige una palabra mal escrita si se parece a UNA sola del vocabulario (misma primera letra). */
export function correctWord(w: string, minLength = 5): string {
  if (w.length < minLength || VOCAB_SET.has(w) || KEEP.has(w) || /\d/.test(w)) return w;
  const max = w.length >= 8 ? 2 : 1;
  let best: string | null = null;
  let bestD = max + 1;
  let tie = false;
  for (const v of VOCAB) {
    if (v[0] !== w[0]) continue;
    const d = editDistance(w, v, max);
    if (d < bestD) {
      best = v;
      bestD = d;
      tie = false;
    } else if (d === bestD && v !== best && v.slice(0, 5) !== best?.slice(0, 5)) tie = true; // «registra»/«registrar»: misma familia, no es empate
  }
  return best && !tie ? best : w;
}

/* ---------------- Texto con marcas: qué palabras ya se entendieron ---------------- */

/** ¿Es una palabra correcta del español? (El servidor usa el diccionario Hunspell; sin él, no se sabe.) */
export type WordCheck = (word: string) => boolean;

class Marked {
  readonly raw: string[];
  readonly tok: string[];
  readonly used: boolean[];
  readonly n: string;
  private readonly starts: number[];
  constructor(text: string, isWord?: WordCheck) {
    // Con diccionario se sabe qué palabras son correctas y se pueden corregir también las de 4 letras.
    const hasDictionary = !!isWord;
    const known: WordCheck = isWord ?? (() => false);
    this.raw = text.trim().split(/\s+/).filter(Boolean);
    // Solo se corrige lo que NO es una palabra del español: «para» no se convierte en «parar».
    this.tok = this.raw.map((t) => {
      const c = cleanToken(t);
      const plain = t.toLowerCase().replace(/[¿?¡!,;:"«»()[\]{}.]/g, "");
      return plain && known(plain) ? c : correctWord(c, hasDictionary ? 4 : 5);
    });
    this.used = this.tok.map((t) => !t);
    this.starts = [];
    let pos = 0;
    for (const t of this.tok) {
      this.starts.push(pos);
      pos += t.length + 1;
    }
    this.n = this.tok.join(" ");
  }
  /** Índices de las palabras que cubre un tramo [start, end) del texto limpio. */
  private range(start: number, end: number): number[] {
    const out: number[] = [];
    this.tok.forEach((t, i) => {
      const s = this.starts[i];
      if (t && s < end && s + t.length > start) out.push(i);
    });
    return out;
  }
  /** Busca y marca; devuelve la coincidencia (con los índices de palabra). Solo palabras aún libres. */
  take(re: RegExp): (RegExpExecArray & { idx: number[] }) | null {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(this.n))) {
      if (m[0].length === 0) {
        g.lastIndex++;
        continue;
      }
      const idx = this.range(m.index, m.index + m[0].length);
      if (idx.length && idx.every((i) => !this.used[i])) {
        idx.forEach((i) => (this.used[i] = true));
        return Object.assign(m, { idx });
      }
    }
    return null;
  }
  test(re: RegExp): boolean {
    return re.test(this.n);
  }
  firstIndex(re: RegExp): number {
    const m = re.exec(this.n);
    return m ? (this.range(m.index, m.index + m[0].length)[0] ?? -1) : -1;
  }
  /** Las palabras libres desde `from`, en su forma original (con mayúsculas y tildes). */
  rest(from = 0, soft = false): string {
    const words: string[] = [];
    for (let i = Math.max(0, from); i < this.raw.length; i++) if (!this.used[i]) words.push(this.raw[i]);
    return tidy(words.join(" "), soft);
  }
}

const EDGE = /^(?:de|del|que|para|a|al|el|la|los|las|un|una|unos|unas|sobre|con|en|y|por|-|–|—|:|lo|le|me|se)$/i;
const SOFT_EDGE = /^(?:que|para|a|al|un|una|y|-|–|—|:|lo|le|me|se)$/i;
/** Quita conectores sueltos al principio y al final, y signos de los extremos (`soft`: conserva «con el…»). */
function tidy(s: string, soft = false): string {
  const w = s.replace(/^[\s:,.;\-–—]+|[\s,;:\-–—]+$/g, "").split(/\s+/).filter(Boolean);
  while (w.length && (soft ? SOFT_EDGE : EDGE).test(cleanToken(w[0]))) w.shift();
  while (w.length && EDGE.test(cleanToken(w[w.length - 1]))) w.pop();
  const out = w.join(" ").replace(/[\s:,;]+$/, "");
  return out ? out[0].toUpperCase() + out.slice(1) : "";
}

/* ---------------- Números, fechas y horas ---------------- */

const NUM_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50,
};
const NUM = String.raw`(?:\d{1,3}(?:[.,]\d{1,2})?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta)`;
const num = (s: string) => (s in NUM_WORDS ? NUM_WORDS[s] : Number(s.replace(",", ".")));

const MONTHS: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const DAYS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const validDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Fecha en lenguaje natural: hoy, mañana, pasado mañana, ayer, anteayer, «el lunes», «el próximo viernes»,
 * «este jueves», «en 3 días», «dentro de 2 semanas», «la próxima semana», «fin de mes», «5/12», «5/12/2026»,
 * «5 de diciembre (de 2026)», «2026-12-05». Sin año: la próxima vez que llegue esa fecha (o el pasado, si `past`).
 */
function takeDate(m: Marked, today: string, opts: { past?: boolean } = {}): string | null {
  let x: RegExpExecArray | null;
  if ((x = m.take(/\bpasado manana\b/))) return addDays(today, 2);
  if ((x = m.take(/\banteayer\b|\bantier\b/))) return addDays(today, -2);
  // «mañana» como día (no «por la mañana» / «de la mañana», que es una franja horaria).
  if ((x = m.take(/(?<!\b(?:la|esta) )\bmanana\b/))) return addDays(today, 1);
  if ((x = m.take(/\bhoy\b/))) return today;
  if ((x = m.take(/\bayer\b/))) return addDays(today, -1);
  if ((x = m.take(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return validDate(+x[1], +x[2], +x[3]) ? `${x[1]}-${x[2]}-${x[3]}` : null;
  if ((x = m.take(/\b(?:el )?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) return dmy(+x[1], +x[2], x[3], today, opts.past);
  const monthNames = Object.keys(MONTHS).join("|");
  if ((x = m.take(new RegExp(String.raw`\b(?:el )?(\d{1,2}|primero) de (${monthNames})(?: (?:de |del )?(\d{4}))?\b`)))) return dmy(x[1] === "primero" ? 1 : +x[1], MONTHS[x[2]], x[3], today, opts.past);
  if ((x = m.take(/\b(?:en|dentro de) (\d{1,3}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta) (dias?|semanas?)\b/))) {
    const k = num(x[1]);
    return addDays(today, x[2].startsWith("semana") ? 7 * k : k);
  }
  if ((x = m.take(/\b(?:la )?(?:proxima semana|semana (?:que viene|proxima)|siguiente semana)\b/))) {
    const wd = weekday(today);
    return addDays(today, ((8 - wd) % 7) || 7); // el lunes siguiente
  }
  if ((x = m.take(/\b(?:a |para )?(?:fin|final|finales) de(?:l)? mes\b/))) {
    const [y, mo] = today.split("-").map(Number);
    return `${y}-${pad(mo)}-${pad(new Date(Date.UTC(y, mo, 0)).getUTCDate())}`;
  }
  const dayNames = Object.keys(DAYS).join("|");
  if ((x = m.take(new RegExp(String.raw`\b(?:el |este |esta |para el |el dia )?(?:(proximo|siguiente|otro) )?(${dayNames})(?: (?:proximo|que viene|siguiente))?(?! pasado)\b`)))) {
    const target = DAYS[x[2]];
    const wd = weekday(today);
    let diff = (target - wd + 7) % 7;
    if (opts.past) {
      diff = -(((wd - target + 7) % 7) || 7);
      return addDays(today, diff);
    }
    if (diff === 0) diff = 7; // «el miércoles» dicho un miércoles: el de la semana que viene
    return addDays(today, diff);
  }
  if (opts.past && (x = m.take(/\b(?:el )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo) pasado\b/))) {
    const wd = weekday(today);
    return addDays(today, -(((wd - DAYS[x[1]] + 7) % 7) || 7));
  }
  return null;
}

function dmy(d: number, mo: number, yRaw: string | undefined, today: string, past?: boolean): string | null {
  const [ty, tm, td] = today.split("-").map(Number);
  let y = yRaw ? Number(yRaw) : ty;
  if (y < 100) y += 2000;
  if (!validDate(y, mo, d)) return null;
  if (!yRaw) {
    const isBefore = mo < tm || (mo === tm && d < td);
    if (past && !isBefore && !(mo === tm && d === td)) y -= 1;
    else if (!past && isBefore) y += 1;
    if (!validDate(y, mo, d)) return null;
  }
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/**
 * Hora: «a las 3», «a las 3 pm», «a las 15:30», «a la 1 de la tarde», «9 de la mañana», «al mediodía»,
 * «por la tarde». Sin am/pm, de 1 a 7 se entiende de la tarde (horario de oficina).
 */
function takeTime(m: Marked): string | null {
  let x: RegExpExecArray | null;
  if ((x = m.take(/\b(?:a )?(?:el |al )?mediodia\b/))) return "12:00";
  const re = /\b(?:a las?|a eso de las?|sobre las?|tipo|antes de las?|para las?)? ?(\d{1,2})(?::|h| y )?(\d{2}|media|cuarto)? ?(am|pm|hrs?|horas?(?= (?:de la|del|am|pm|$))|de la (?:manana|tarde|noche)|en la (?:manana|tarde|noche)|del mediodia)?\b/;
  // Para no confundir números sueltos (cantidades, días) con horas, se exige «a las», ":" o am/pm.
  const g = new RegExp(re.source, "g");
  let mm: RegExpExecArray | null;
  while ((mm = g.exec(m.n))) {
    const whole = mm[0];
    const hasLead = /^(?:a las?|a eso de|sobre las?|tipo|antes de las?|para las?)\b/.test(whole);
    const hasColon = /\d:\d{2}/.test(whole);
    const hasMer = !!mm[3] && !/^horas?$/.test(mm[3]);
    if (!hasLead && !hasColon && !hasMer) continue;
    if (/\d:\d{2}/.test(whole) === false && /\b\d{1,2}\s*(?:horas?|h)\b/.test(whole) && !hasLead) continue; // «2 horas» es duración
    x = m.take(new RegExp(whole.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    if (!x) continue;
    let h = Number(mm[1]);
    let min = mm[2] === "media" ? 30 : mm[2] === "cuarto" ? 15 : mm[2] ? Number(mm[2]) : 0;
    const mer = mm[3] ?? "";
    if (h > 23 || min > 59) return null;
    if (/pm|tarde|noche/.test(mer) && h < 12) h += 12;
    else if (/am|manana/.test(mer) && h === 12) h = 0;
    else if (!mer && h >= 1 && h <= 7) h += 12;
    return `${pad(h)}:${pad(min)}`;
  }
  if ((x = m.take(/\b(?:por|en|de) la manana\b|\btemprano\b/))) return "09:00";
  if ((x = m.take(/\b(?:por|en|de) la tarde\b/))) return "15:00";
  if ((x = m.take(/\b(?:al final del dia|fin del dia)\b/))) return "17:00";
  return null;
}

/** Duración: «2 horas», «2h», «1h30», «1:30 h», «90 minutos», «media hora», «hora y media», «2 horas y cuarto», «1,5 horas». */
export function takeMinutes(m: Marked): number | null {
  let x: RegExpExecArray | null;
  if ((x = m.take(/\b(?:una )?hora y media\b/))) return 90;
  if ((x = m.take(/\bmedia hora\b/))) return 30;
  if ((x = m.take(/\b(?:un )?cuarto de hora\b/))) return 15;
  if ((x = m.take(/\b(\d{1,2})h ?(\d{1,2})(?:m|min)?\b/))) return +x[1] * 60 + +x[2];
  if ((x = m.take(/\b(\d{1,2}):(\d{2}) ?(?:h|hrs?|horas?)\b/))) return +x[1] * 60 + +x[2];
  if ((x = m.take(new RegExp(String.raw`\b(${NUM}) (?:h|hr|hrs|horas?)(?: y (media|cuarto|(${NUM}) (?:min|minutos?)))?\b`)))) {
    const h = num(x[1]);
    const extra = x[2] === "media" ? 30 : x[2] === "cuarto" ? 15 : x[3] ? num(x[3]) : 0;
    return Math.round(h * 60 + extra);
  }
  if ((x = m.take(new RegExp(String.raw`\b(\d{1,2}(?:[.,]\d{1,2})?)h\b`)))) return Math.round(num(x[1]) * 60);
  if ((x = m.take(new RegExp(String.raw`\b(${NUM}) ?(?:min|mins|minutos?|m)\b`)))) return Math.round(num(x[1]));
  return null;
}

/* ---------------- Expediente, persona, prioridad ---------------- */

/** «EXP-2026-0001», «exp 2026-1», «2026-0001», «ese expediente», «el mismo caso», «en el caso de despido». */
function takeMatter(m: Marked, opts: { allowText?: boolean } = {}): MatterRef | null {
  let x: RegExpExecArray | null;
  if ((x = m.take(/\b(?:(?:en|del|al|para) (?:el )?)?(?:expediente |exp |caso )?exp-?(\d{4})-?(\d{1,4})\b/))) return { kind: "numero", number: `EXP-${x[1]}-${x[2].padStart(4, "0")}` };
  if ((x = m.take(/\b(?:(?:en|del|al|para) (?:el )?)?(?:expediente|exp|caso) (?:n(?:o|umero)? )?(\d{4})-(\d{1,4})\b/))) return { kind: "numero", number: `EXP-${x[1]}-${x[2].padStart(4, "0")}` };
  if ((x = m.take(/\b(?:(?:en|del|al|para) (?:el )?)?(20\d{2})-(\d{1,4})\b/))) return { kind: "numero", number: `EXP-${x[1]}-${x[2].padStart(4, "0")}` };
  if ((x = m.take(/\b(?:(?:en|de|del|a|al|para|sobre) )?(?:ese|este|el mismo|dicho|aquel|el ultimo|el) (?:expediente|caso|asunto)(?: (?:anterior|de antes|que vimos|del que hablamos))?(?! (?:de|del|sobre|n|no|numero|exp)\b)(?! ?\d)/))) return { kind: "contexto" };
  if ((x = m.take(/\b(?:en|de|del|a|al|para) (?:ese|este|el mismo|dicho)\b(?! \w+ \w)/))) return { kind: "contexto" };
  if ((x = m.take(/\b(?:alli|ahi|ahi mismo)\b/))) return { kind: "contexto" };
  if (opts.allowText && (x = m.take(/\b(?:en|del|al|para) (?:el )?(?:expediente|caso|asunto) (?:de |del |sobre )?((?:(?!a las|para|con|prioridad|asignad|manana|hoy|el lunes|el martes|el miercoles|el jueves|el viernes|:)[a-z0-9ñ]+ ?){1,5})/))) {
    const text = x[1].trim();
    if (text) return { kind: "texto", text };
  }
  return null;
}

const NAME = String.raw`([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)`;
/** «asignada a Lucía», «para Marcos», «que la haga Ana», «a mí», «para mí». Los nombres se reconocen por la mayúscula. */
function takeAssignee(m: Marked, raw: string): string | null {
  let x: RegExpExecArray | null;
  if ((x = m.take(/\b(?:asignad[ao]s? |asigna(?:la|lo|sela|selo)? |asignar(?:la|lo|sela)? )?(?:a|para) mi\b(?! \w)|\bpara mi\b/))) return "@yo";
  const names: string[] = [];
  for (const mm of raw.matchAll(new RegExp(String.raw`(?:[Aa]signad[ao]s? a|[Aa]s[ií]gn[aá](?:la|lo|sela|selo)? a|[Aa]signar(?:la|lo|sela)? a|que (?:la|lo) haga|[Ee]ncarg[aá](?:sela|selo|le)? a|para) ${NAME}`, "g"))) names.push(mm[1]);
  for (const name of names) {
    const lead = strip(name.split(" ")[0]);
    if (lead in DAYS || lead in MONTHS || ["el", "la", "las", "los", "mi", "hoy", "manana"].includes(lead)) continue;
    const parts = strip(name).split(" ");
    const re = new RegExp(String.raw`\b(?:asignad[ao]s? a|asigna(?:la|lo|sela|selo)? a|asignar(?:la|lo|sela)? a|que (?:la|lo) haga|encarga(?:sela|selo|le)? a|para) ${parts.join(" ")}\b`);
    if (m.take(re)) return name;
  }
  return null;
}

function takePriority(m: Marked): Priority | null {
  let x: RegExpExecArray | null;
  if ((x = m.take(/\b(?:con |de )?(?:prioridad )?(urgente|urgentisim[oa])\b|\bes urgente\b|\bya mismo\b/))) return "urgente";
  if ((x = m.take(/\b(?:con |de )?(?:prioridad alta|alta prioridad|muy importante|importante)\b/))) return "alta";
  if ((x = m.take(/\b(?:con |de )?(?:prioridad baja|baja prioridad|sin prisa|cuando se pueda|no es urgente)\b/))) return "baja";
  if ((x = m.take(/\b(?:con |de )?prioridad normal\b/))) return "normal";
  return null;
}

/* ---------------- Reconocimiento de la orden ---------------- */

const HOWTO = /^(?:como|donde|se puede|puedo|es posible|como se|como puedo|como hago|ayuda con|explica|que es)\b/;
const CREATE = String.raw`(?:crea|crear|creame|creeme|crealo|haz|hazme|hacer|anade|anadir|anademe|agrega|agregar|agregame|pon|ponme|poner|anota|anotar|anotame|apunta|apuntar|apuntame|registra|registrar|registrame|programa|programar|programame|agenda|agendar|agendame|genera|generar|nueva|nuevo|mete|meter|guarda|guardar|deja|dejame|necesito|quiero)`;

export function parseCommand(text: string, today: string, opts: { isWord?: WordCheck } = {}): ParsedCommand | null {
  const raw = text.slice(0, 500).trim();
  if (!raw) return null;
  const m = new Marked(raw, opts.isWord);
  const n = m.n;
  // Lo que va antes de «:» es la orden; lo de después, el texto libre (título, nota, descripción). El tipo de
  // orden se decide solo con la primera parte: «registra 2 horas…: reunión con el cliente» no es una reunión.
  const colonAt = commandColon(raw);
  const head = colonAt >= 0 ? new Marked(raw.slice(0, colonAt), opts.isWord).n : n;
  if (HOWTO.test(n) || /^(?:que|cual|cuales|cuanto|cuanta|cuando) (?:es|son|significa)\b/.test(n)) {
    // «¿qué tareas tengo?», «¿cuántas horas llevo hoy?» sí son consultas que se responden con datos.
    return queries(m);
  }

  // --- Cronómetro ---
  if (/\b(cronometro|temporizador|reloj|contador de tiempo)\b/.test(n) || /^(?:empiezo|empece|comienzo|arranco|me pongo) a trabajar\b/.test(n)) {
    const op: TimerOp = /\b(descarta\w*|cancela\w*|borra\w*|elimina\w*|tira\w*)\b/.test(n)
      ? "descartar"
      : /\b(reanuda\w*|continua\w*|sigue|seguir|retoma\w*|vuelve a)\b/.test(n)
        ? "reanudar"
        : /\b(pausa\w*|pausalo|espera|un momento)\b/.test(n)
          ? "pausar"
          : /\b(deten\w*|para|paralo|parar|termina\w*|finaliza\w*|apaga\w*|corta\w*|cierra\w*|guarda\w*|registra\w*|acaba\w*|stop)\b/.test(n)
            ? "detener"
            : /\b(inicia\w*|arranca\w*|empieza|empezar|empiezo|comienza\w*|comienzo|activa\w*|pon|ponme|poner|enciende|start|abre|me pongo|arranco)\b/.test(n)
              ? "iniciar"
              : "ver";
    m.take(/\b(?:el |un |mi )?(?:cronometro|temporizador|reloj|contador de tiempo)\b/);
    m.take(/\b(?:inicia\w*|arranca\w*|empieza|empezar|empiezo|comienza\w*|comienzo|activa\w*|pon|ponme|poner|enciende|start|abre|me pongo|arranco|deten\w*|para|paralo|parar|termina\w*|finaliza\w*|apaga\w*|corta\w*|cierra\w*|guarda\w*|registra\w*|acaba\w*|stop|pausa\w*|reanuda\w*|continua\w*|sigue|retoma\w*|descarta\w*|cancela\w*|borra\w*)\b/);
    m.take(/\b(?:empece|comienzo|empiezo|arranco|me pongo) a trabajar\b|\ba trabajar\b/);
    const matter = takeMatter(m, { allowText: true });
    const colon = raw.indexOf(":");
    const description = colon >= 0 && !/\d:\d/.test(raw.slice(colon - 1, colon + 2)) ? tidy(raw.slice(colon + 1)) : m.rest();
    return { type: "cronometro", op, matter, description: op === "detener" || op === "iniciar" ? cleanDesc(description) : "" };
  }

  // --- Registrar horas («registra 2 horas…», «trabajé 1h30 en…») ---
  const hoursVerb = /\b(registra\w*|anota\w*|apunta\w*|carga\w*|imputa\w*|pon|ponme|agrega\w*|anade\w*|mete\w*|suma\w*|trabaje|trabajamos|dedique|estuve|invert\w*|me llevo|llevo)\b/;
  if (hoursVerb.test(head) && /\b(\d+(?:[.,]\d+)?\s?(?:h|hr|hrs|horas?|min|mins|minutos?)\b|\d+h\d*|\d{1,2}:\d{2}\s?h|media hora|hora y media|una hora|un cuarto de hora|(?:dos|tres|cuatro|cinco|seis|siete|ocho) horas)/.test(head) && !/\b(tarea|recordatorio|recuerdame|audiencia|reunion|cita|plazo)\b/.test(head) && !/^(?:cuantas|cuanto)\b/.test(n)) {
    const minutes = takeMinutes(m);
    const date = takeDate(m, today, { past: true });
    const matter = takeMatter(m, { allowText: true });
    const billable = m.take(/\b(?:no facturables?|sin facturar|sin cobrar|gratis|no cobrable)\b/) ? false : m.take(/\bfacturables?\b/) ? true : null;
    m.take(hoursVerb);
    m.take(/\b(?:de trabajo|trabajadas?|de tiempo)\b/);
    const colon = raw.indexOf(":");
    const description = colon >= 0 && !/\d:\d/.test(raw.slice(Math.max(0, colon - 1), colon + 2)) ? cleanDesc(tidy(stripRecognized(raw.slice(colon + 1)))) : cleanDesc(m.rest());
    return { type: "horas", minutes, date, matter, description, billable };
  }

  // --- Notas («añade una nota al EXP…: llamó el cliente») ---
  if (/\b(nota|apunte|comentario)\b/.test(head) && new RegExp(String.raw`\b${CREATE}\b|\bescribe\w*\b`).test(head) && !/\bnotari/.test(head)) {
    m.take(new RegExp(String.raw`\b${CREATE}\b|\bescribe\w*\b`));
    m.take(/\b(?:una |la |otra )?(?:nota|apunte|comentario)\b/);
    const matter = takeMatter(m, { allowText: false });
    const colon = raw.indexOf(":");
    const body = colon >= 0 ? verbatim(raw.slice(colon + 1)) : m.rest();
    return { type: "nota", matter, body: body.replace(/^que /i, "") };
  }

  // --- Completar una tarea («marca como hecha la tarea revisar contrato») ---
  if (/\b(?:marca\w*|pon|ponla|da|dala|dejala|deja) (?:la tarea |el plazo |la |lo )?.*\b(?:como )?(?:hecha|hecho|completada|completado|terminada|terminado|lista|listo|resuelta|cumplida|cumplido)\b|\b(?:complete|termine|acabe|hice|ya hice|finalice|cumpli|resolvi)\b|\b(?:completa|completar|termina|terminar|cierra|cerrar|finaliza|finalizar) (?:la |el )?(?:tarea|plazo|pendiente)\b/.test(n)) {
    m.take(/\b(?:marca\w*|pon|ponla|da|dala|dejala|deja|ya)\b/);
    m.take(/\b(?:como )?(?:hecha|hecho|completada|completado|terminada|terminado|lista|listo|resuelta|cumplida|cumplido)\b/);
    m.take(/\b(?:complete|termine|acabe|hice|finalice|cumpli|resolvi|completa|completar|termina|terminar|cierra|cerrar|finaliza|finalizar|por)\b/);
    m.take(/\b(?:la |el |mi )?(?:tarea|plazo|pendiente)\b/);
    const matter = takeMatter(m, { allowText: false });
    const what = m.rest();
    if (what || matter) return { type: "completar", what, matter };
  }

  // --- Estado del expediente («pasa el EXP… a en espera», «cierra el expediente de despido») ---
  const statusWord: [RegExp, MatterStatus][] = [
    [/\ben espera\b|\bpausad[oa]\b|\bsuspendid[oa]\b/, "en_espera"],
    [/\ben curso\b|\ben tramite\b|\bactivo\b/, "en_curso"],
    [/\barchiv\w*/, "archivado"],
    [/\bcerrad[oa]\b|\bcierra\b|\bcerrar\b|\bcierre\b|\bfinalizad[oa]\b|\bconcluid[oa]\b/, "cerrado"],
    [/\breabr\w*|\babiert[oa]\b|\breabre\b/, "abierto"],
  ];
  if (/\b(expediente|caso|asunto|exp-?\d{4}|20\d{2}-\d{1,4})\b/.test(n) && /\b(pasa|pasalo|cambia|cambialo|pon|ponlo|mueve|muevelo|marca|marcalo|deja|dejalo|cierra|cerrar|archiva|archivar|reabre|reabrir|estado)\b/.test(n) && !/\b(tarea|tareas|pendiente|recuerdame|recordarme|recordatorio|avisame)\b/.test(n)) {
    const st = statusWord.find(([re]) => re.test(n));
    if (st) {
      const matter = takeMatter(m, { allowText: true }) ?? textMatter(m);
      return { type: "estado", matter, status: st[1] };
    }
  }

  // --- Audiencias, reuniones y plazos ---
  const evWord = /\b(audiencia|reunion|cita|junta|plazo|vencimiento|vence)\b/;
  const evCreate = new RegExp(String.raw`\b${CREATE}\b|\bhay (?:una|un)\b|\btengo (?:una|un)\b|\bsenala\w*\b|\bfija\w*\b|\bconvoca\w*\b`);
  if (evWord.test(head) && evCreate.test(head) && !/^(?:cuando|cuanto|que|cual|hay)\b/.test(n) && !/\b(tarea|recuerdame|recordarme|recordatorio)\b/.test(head)) {
    const kindTxt = head.match(evWord)![1];
    const kind: EventKind = kindTxt === "audiencia" ? "audiencia" : /reunion|cita|junta/.test(kindTxt) ? "reunion" : "plazo";
    const date = takeDate(m, today);
    const time = takeTime(m);
    const matter = takeMatter(m, { allowText: true });
    const assignee = takeAssignee(m, raw);
    m.take(evCreate);
    const anchor = m.firstIndex(evWord);
    m.take(/\b(?:una |un |la |el |nueva |nuevo )?(?:audiencia|reunion|cita|junta|plazo|vencimiento)\b/) ?? m.take(/\b(?:audiencia|reunion|cita|junta|plazo|vencimiento)\b/);
    m.take(/\b(?:que )?vence\b/);
    const colon = raw.indexOf(":");
    let title = colon >= 0 && !/\d:\d/.test(raw.slice(Math.max(0, colon - 1), colon + 2)) ? tidy(stripRecognized(raw.slice(colon + 1))) : m.rest(anchor, true);
    if (!title) title = m.rest(0, true);
    return { type: "evento", kind, title: eventTitle(kind, title), date, time, matter, assignee };
  }

  // --- Tareas y recordatorios ---
  const taskWord = /\b(tarea|tareas|pendiente|recordatorio|to ?do)\b/;
  const remind = /\b(recuerdame|recordarme|recordame|avisame|no me dejes olvidar)\b/;
  if ((taskWord.test(head) && new RegExp(String.raw`\b${CREATE}\b|\basigna\w*|\bencarga\w*`).test(head)) || remind.test(head) || /^(?:tarea|recordatorio|pendiente)\b/.test(n)) {
    const date = takeDate(m, today);
    const time = takeTime(m);
    const matter = takeMatter(m, { allowText: true });
    const assignee = takeAssignee(m, raw);
    const priority = takePriority(m);
    m.take(new RegExp(String.raw`\b${CREATE}\b|\basigna\w*|\bencarga\w*`));
    m.take(remind);
    const anchor = Math.max(m.firstIndex(taskWord), m.firstIndex(remind));
    m.take(/\b(?:una |un |la |el |nueva |nuevo |otra |otro )?(?:tarea|pendiente|recordatorio|to ?do)\b/) ?? m.take(/\b(?:tarea|pendiente|recordatorio|to ?do)\b/);
    m.take(/\b(?:que tengo que|que debo|tengo que|hay que|debo)\b/);
    const colon = raw.indexOf(":");
    let title = colon >= 0 && !/\d:\d/.test(raw.slice(Math.max(0, colon - 1), colon + 2)) ? tidy(stripRecognized(raw.slice(colon + 1))) : m.rest(anchor);
    if (!title) title = m.rest();
    return { type: "tarea", title, date, time, matter, assignee, priority };
  }

  return queries(m);
}

/** Posición de los «:» que separan la orden del texto libre (no los de una hora como 10:30). */
function commandColon(raw: string): number {
  for (let i = 0; i < raw.length; i++) if (raw[i] === ":" && !(/\d/.test(raw[i - 1] ?? "") && /\d/.test(raw[i + 1] ?? ""))) return i;
  return -1;
}

/** Consultas sobre lo propio que se responden con datos: «mis tareas», «¿cuántas horas llevo esta semana?». */
function queries(m: Marked): ParsedCommand | null {
  const n = m.n;
  if (/\b(?:mis tareas|mis pendientes|que tareas tengo|tareas (?:que tengo|pendientes|asignadas)|que tengo pendiente|que me toca|que debo hacer|tareas de hoy|tareas vencidas|tareas atrasadas)\b/.test(n) && !/\b(?:crea|crear|anade|agrega|nueva)\b/.test(n)) {
    return { type: "mis_tareas", scope: /\bvencid|atrasad/.test(n) ? "vencidas" : /\bhoy\b/.test(n) ? "hoy" : /\bsemana\b/.test(n) ? "semana" : "todas" };
  }
  if (/\b(?:cuantas horas|cuanto tiempo (?:llevo|he (?:registrado|trabajado)|registre|trabaje)|mis horas|horas (?:llevo|he registrado|registradas|trabajadas|que llevo)|que horas (?:llevo|registre|he registrado))\b/.test(n) && !/\bregistra (?:\d|una|dos|media)/.test(n) && !/\b(apelar|contestar|plazo|prescri)/.test(n)) {
    return { type: "mis_horas", period: /\bhoy\b/.test(n) ? "hoy" : /\bmes\b/.test(n) ? "mes" : "semana" };
  }
  if (/\b(?:como va|como esta|cuanto lleva|estado del|ver|tengo|hay) (?:el |un |mi |algun )?(?:cronometro|temporizador)\b|^(?:el |mi )?cronometro$/.test(n)) return { type: "cronometro", op: "ver", matter: null, description: "" };
  return null;
}

function textMatter(m: Marked): MatterRef | null {
  const x = m.take(/\b(?:el |del )?(?:expediente|caso|asunto) (?:de |del |sobre )?((?:[a-z0-9ñ]+ ?){1,5})/);
  return x && x[1].trim() ? { kind: "texto", text: x[1].trim() } : null;
}

/** Quita de un texto libre las fechas y horas que ya se entendieron por separado («: revisar contrato mañana»). */
function stripRecognized(s: string): string {
  const mk = new Marked(s);
  takeDate(mk, "2000-01-01");
  takeTime(mk);
  takeMatter(mk);
  takePriority(mk);
  return mk.rest();
}

/** Texto libre tal cual (solo sin espacios ni signos en los extremos y con mayúscula inicial). */
function verbatim(s: string): string {
  const t = s.trim().replace(/^[\s:,;\-–—]+/, "").replace(/\s+/g, " ");
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

function cleanDesc(s: string): string {
  return tidy(s.replace(/^(?:de |por |en )?(?:trabajo|tiempo)\b/i, ""));
}

const defaultTitle = (k: EventKind) => (k === "audiencia" ? "Audiencia" : k === "reunion" ? "Reunión" : "Plazo");
/** «Audiencia preliminar», «Reunión con el cliente», «Plazo: contestar la demanda». */
function eventTitle(kind: EventKind, rest: string): string {
  const label = defaultTitle(kind);
  if (!rest) return label;
  if (strip(rest).startsWith(strip(label))) return rest;
  const lower = rest[0].toLowerCase() + rest.slice(1);
  if (kind === "plazo") return `${label}: ${lower}`;
  // Una reunión «Con el cliente»: tidy quitó el «con»; se recupera si el resto no lo trae.
  return `${label} ${lower}`;
}

/* ---------------- Utilidades para mostrar y probar ---------------- */

export const STATUS_LABELS: Record<MatterStatus, string> = { abierto: "Abierto", en_curso: "En curso", en_espera: "En espera", cerrado: "Cerrado", archivado: "Archivado" };

/** «jueves 27/11/2026» */
export function describeDate(date: string): string {
  const names = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return `${names[weekday(date)]} ${date.split("-").reverse().join("/")}`;
}

export function describeMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const r = min % 60;
  return h && r ? `${h} h ${r} min` : h ? `${h} h` : `${r} min`;
}

export const __test = { cleanToken, correctWord, Marked: (t: string, isWord?: WordCheck) => new Marked(t, isWord), takeDate: (t: string, today: string, past = false) => takeDate(new Marked(t), today, { past }), takeTime: (t: string) => takeTime(new Marked(t)), takeMinutes: (t: string) => takeMinutes(new Marked(t)) };
