/**
 * Guía inicial de la base de conocimiento (Costa Rica). Redactada a partir del texto vigente del
 * Código de Trabajo (versión 64) y del Código Procesal Civil (Ley 9342, versión 5), consultados en el
 * SCIJ. Se carga marcada como «sin revisar»: el despacho debe revisarla y completarla.
 */
export type GuideEntry = { title: string; area: string; keywords: string; refs: string; body: string };

export const KNOWLEDGE_AREAS: Record<string, string> = {
  laboral: "Laboral",
  civil: "Civil y procesal",
  familia: "Familia",
  notarial: "Notarial",
  penal: "Penal",
  administrativo: "Administrativo",
  comercial: "Comercial",
  tributario: "Tributario",
  despacho: "Procedimientos del despacho",
  general: "General",
};

export const GUIDE: GuideEntry[] = [
  {
    title: "Preaviso: cuánto corresponde",
    area: "laboral",
    keywords: "preaviso aviso previo despido renuncia cuántos días semana quince días un mes liquidación prestaciones",
    refs: "ley-2:28,30",
    body: `En el contrato por tiempo indefinido, quien le pone fin sin justa causa debe avisar a la otra parte con anticipación (art. 28 del Código de Trabajo):
- De 3 a 6 meses de trabajo continuo: al menos una semana.
- De más de 6 meses a un año: al menos quince días.
- Más de un año: al menos un mes.

El aviso se da por escrito (si el contrato fue verbal, el trabajador puede darlo ante dos testigos). Puede omitirse pagando el salario de esos plazos. Durante el preaviso el patrono debe conceder un día libre por semana para buscar empleo.
La base de cálculo es el promedio de salarios de los últimos seis meses (art. 30, inciso b). El preaviso no se puede compensar, vender, ceder ni embargar, salvo la mitad por pensión alimentaria (art. 30, inciso a).
Para calcularlo: Herramientas → Liquidación laboral.`,
  },
  {
    title: "Auxilio de cesantía: tabla y tope",
    area: "laboral",
    keywords: "cesantía auxilio de cesantía despido injustificado tabla días por año tope ocho años liquidación prestaciones indemnización",
    refs: "ley-2:29,30,83",
    body: `Corresponde cuando el contrato por tiempo indeterminado termina por despido injustificado, por alguna causa del art. 83 u otra ajena a la voluntad del trabajador (art. 29 del Código de Trabajo):
- De 3 a 6 meses: 7 días de salario.
- Más de 6 meses y menos de un año: 14 días.
- Más de un año, días por año laborado según los años de servicio: 1.º 19,5 · 2.º 20 · 3.º 20,5 · 4.º 21 · 5.º 21,24 · 6.º 21,5 · 7.º, 8.º y 9.º 22 · 10.º 21,5 · 11.º 21 · 12.º 20,5 · 13.º y siguientes 20. Desde el segundo año, la fracción superior a seis meses cuenta como año.
- Nunca se indemnizan más de los últimos ocho años (art. 29, inciso 4).

Ejemplo: 3 años y 7 meses cuentan como 4 años → 21 días × 4 = 84 días de salario.
La base es el promedio de salarios de los últimos seis meses (art. 30, inciso b). La continuidad no se interrumpe por enfermedad, vacaciones, huelga legal u otras causas análogas (art. 30, inciso c).
Para calcularlo: Herramientas → Liquidación laboral.`,
  },
  {
    title: "Vacaciones: derecho y pago al terminar",
    area: "laboral",
    keywords: "vacaciones días de vacaciones proporcionales pago de vacaciones compensar acumular cincuenta semanas",
    refs: "ley-2:153,156,157",
    body: `Mínimo de dos semanas de vacaciones pagadas por cada cincuenta semanas de labores continuas con el mismo patrono (art. 153). Si el contrato termina antes de completar las cincuenta semanas, corresponde como mínimo un día por cada mes trabajado, que se paga al retirarse.
Las vacaciones no se compensan en dinero, salvo (art. 156): cuando el trabajador cesa por cualquier causa (se pagan las no disfrutadas), en trabajo ocasional o a destajo, o por acuerdo para el exceso del mínimo, sin superar tres períodos acumulados y no más de una vez cada dos años.
El salario de vacaciones se calcula con el promedio de las remuneraciones ordinarias y extraordinarias de las últimas cincuenta semanas en empresas comerciales, industriales o de otra índole (art. 157).`,
  },
  {
    title: "Aguinaldo",
    area: "laboral",
    keywords: "aguinaldo décimo tercer mes treceavo diciembre proporcional cálculo",
    refs: "",
    body: `El aguinaldo (Ley 2412 y sus reformas) equivale a la doceava parte de lo devengado entre el 1 de diciembre del año anterior y el 30 de noviembre, y se paga en los primeros veinte días de diciembre. Si la relación termina antes, se paga la parte proporcional.
Para estimarlo: Herramientas → Liquidación laboral (salarios desde el 1 de diciembre ÷ 12).
Nota: la Ley 2412 no está cargada en la app; confirma el detalle en el SCIJ.`,
  },
  {
    title: "Prescripción en materia laboral",
    area: "laboral",
    keywords: "prescripción prescribe plazo para demandar reclamar derechos laborales un año un mes seis meses despido disciplinar",
    refs: "ley-2:413,414,415,416",
    body: `- Derechos y acciones del contrato de trabajo: prescriben en un año desde la extinción del contrato (art. 413). La prescripción se interrumpe, además, al pedir la carta de despido (art. 35), con la conciliación administrativa ante el MTSS, con el reclamo ante el INS por riesgos del trabajo y por cualquier gestión judicial o extrajudicial de cobro; y no corre mientras se trabaja para el mismo patrono.
- El patrono, para despedir con justa causa o disciplinar: un mes desde que se dio o conoció la falta (art. 414).
- Ejecución de sanciones impuestas por escrito tras un procedimiento: caduca en un año desde la firmeza (art. 415).
- El trabajador, para dar por terminado el contrato con justa causa: seis meses desde que el patrono dio el motivo o desde que lo conoció (art. 416).`,
  },
  {
    title: "Feriados en Costa Rica",
    area: "laboral",
    keywords: "feriados días feriados pago obligatorio no obligatorio asueto",
    refs: "ley-2:148,149",
    body: `Feriados de pago obligatorio (art. 148): 1 de enero, 11 de abril, Jueves y Viernes Santos, 1 de mayo, 25 de julio, 15 de agosto, 15 de setiembre y 25 de diciembre.
Feriados de pago no obligatorio: 2 de agosto, 31 de agosto y 1 de diciembre.
El 25 de julio se celebra siempre en su fecha. El 12 de octubre no es feriado. Está prohibido ocupar a los trabajadores en días feriados (art. 149).
La app usa estos feriados para contar días hábiles (Herramientas → Vencimiento de un plazo, e índice notarial).`,
  },
  {
    title: "Cómo se cuentan los plazos procesales",
    area: "civil",
    keywords: "plazos conteo días hábiles cómo se cuentan vencimiento notificación inhábil prórroga meses años",
    refs: "ley-9342:30",
    body: `Código Procesal Civil, art. 30.5:
- Los plazos corren desde el día hábil siguiente a aquel en que quedó notificada la resolución a todas las partes (salvo otro punto de partida legal).
- Los plazos por días son hábiles.
- Por meses o años, de fecha a fecha; si el día no existe en el mes de vencimiento, vence el último día del mes.
- Si el último día es inhábil, se prorroga al siguiente día hábil.
Los plazos son improrrogables salvo disposición en contrario, y pueden interrumpirse por caso fortuito o fuerza mayor si se alega dentro de los cinco días siguientes a que cese (art. 30.1). Vencido un plazo perentorio, se rechaza de plano la gestión (art. 30.2).
Para calcular una fecha: Herramientas → Vencimiento de un plazo procesal.`,
  },
  {
    title: "Recursos: revocatoria, apelación y casación (plazos)",
    area: "civil",
    keywords: "recurso revocatoria apelación apelar casación plazo para apelar cuánto tiempo tengo para recurrir autos sentencias impugnar",
    refs: "ley-9342:65,66,67,69",
    body: `Código Procesal Civil:
- Revocatoria (art. 66.1): contra autos, ante el mismo tribunal, dentro del tercer día si el auto es escrito, o de inmediato si se dicta en audiencia. El auto que deniega la revocatoria no tiene recurso.
- Apelación (art. 67): de autos escritos, 3 días; de sentencias, 5 días.
- Casación (art. 69): contra sentencias de procesos ordinarios de mayor cuantía o inestimables y otros casos que diga la ley; se interpone ante el tribunal que dictó la resolución en el plazo de 15 días (art. 69.3).
Solo se puede impugnar por los medios y en los casos que la ley establece (art. 65.1).`,
  },
  {
    title: "Proceso ordinario: plazo para contestar",
    area: "civil",
    keywords: "proceso ordinario contestar demanda contestación reconvención emplazamiento treinta días",
    refs: "ley-9342:102",
    body: `Si la demanda cumple los requisitos, se emplaza a la parte demandada. Para contestar y reconvenir, el tribunal da un plazo perentorio de treinta días (art. 102.1 del Código Procesal Civil).
Formulario relacionado: Formularios → Contestación de demanda.`,
  },
  {
    title: "Proceso sumario: plazo para contestar",
    area: "civil",
    keywords: "proceso sumario contestar demanda cinco días única audiencia conversión a ordinario",
    refs: "ley-9342:103",
    body: `En el proceso sumario, el plazo para contestar la demanda es de cinco días (art. 103.2 del Código Procesal Civil). Se tramita en una única audiencia (art. 103.3). Si la sentencia desestima la demanda, el actor puede pedir, dentro de los diez días siguientes a su firmeza, que el sumario se convierta en ordinario.`,
  },
  {
    title: "Proceso monitorio (cobro y desahucio)",
    area: "civil",
    keywords: "monitorio cobro judicial deuda dinero obligaciones dinerarias pagaré letra cheque desahucio alquiler oposición intimación cinco días",
    refs: "ley-9342:110,111,112",
    body: `Por el proceso monitorio se tramitan (art. 110.1 del Código Procesal Civil):
1. El cobro de obligaciones dinerarias líquidas y exigibles, fundadas en documentos públicos o privados, con fuerza ejecutiva o sin ella (monitorio dinerario, art. 111).
2. El desahucio de un arrendamiento que conste por escrito, por vencimiento del plazo, falta de pago de la renta o de servicios, o gastos de condominio (monitorio arrendaticio, art. 112).
Admitida la demanda, se dicta la resolución intimatoria y el demandado tiene cinco días para cumplir u oponerse (art. 110.2). Si no se opone o la oposición es infundada, se ejecuta sin más trámite (art. 110.3); si es fundada, se va a una audiencia oral como en el sumario (art. 110.4).`,
  },
  {
    title: "Índice notarial e INDEX",
    area: "notarial",
    keywords: "índice notarial quincena INDEX Archivo Nacional presentar índices plazo cinco días hábiles en blanco",
    refs: "ley-7764:27",
    body: `El notario presenta el índice de las escrituras de cada quincena (del 1 al 15 y del 16 al último día del mes) dentro de los cinco días hábiles siguientes, por medio de la plataforma INDEX del Archivo Nacional, con firma digital (Código Notarial, art. 27, reformado por la Ley 10798). Si no otorgó escrituras, el índice se presenta igualmente en blanco.
En la app: Gestor notarial → Índice muestra el plazo de cada quincena, permite copiar las filas para INDEX y anotar el acuse.`,
  },
  {
    title: "Cómo usar el asistente y la base de conocimiento",
    area: "general",
    keywords: "ayuda asistente cómo funciona base de conocimiento preguntas",
    refs: "",
    body: `El asistente responde con los datos del despacho (expedientes, clientes, plazos, facturas, escritos), con esta base de conocimiento y con las leyes cargadas en Normativa.
Ejemplos: «¿cuánto tiempo tengo para apelar una sentencia?», «calcula la cesantía de 3 años y 7 meses con salario de 600 000», «¿cuándo vence un plazo de 5 días notificado el 20/11?», «artículo 29 del código de trabajo», «estado del EXP-2026-0001».
Para que aprenda algo nuevo, añade una entrada en Conocimiento: título claro, explicación, palabras con las que la buscarías y referencias legales.`,
  },
];
