/**
 * Guía de uso de la aplicación: una sola fuente para el botón «?» de cada pantalla, los recorridos guiados
 * y el centro de ayuda (/ayuda). Contenido puro (sin base de datos), en el mismo tono que la app.
 *
 * Los recorridos señalan elementos reales de la pantalla con `data-tour="…"` (o un selector CSS). Si un
 * elemento no está (por permisos o por el tamaño de pantalla), ese paso se salta solo.
 */
import type { Permission } from "../permissions";

export type HowTo = { title: string; steps: string[] };
export type Faq = { q: string; a: string };
export type TourStep = { target: string | null; title: string; text: string };
export type Tour = { key: string; title: string; path: string; steps: TourStep[] };

export type Guide = {
  key: string;
  title: string;
  /** Grupo en el centro de ayuda. */
  group: "Primeros pasos" | "Trabajo diario" | "Escritos y documentos" | "Consulta" | "Notaría" | "Facturación" | "Administración";
  /** Pantallas a las que corresponde (ruta sin parámetros de búsqueda). */
  match: RegExp;
  /** Dónde está en la app (para el centro de ayuda). */
  href?: string;
  permission?: Permission;
  summary: string;
  howTo: HowTo[];
  tips?: string[];
  faq?: Faq[];
  tour?: string;
  /** Palabras con las que se busca esta guía. */
  keywords?: string;
};

/* ======================================================================================
 * Recorridos guiados
 * ==================================================================================== */

export const TOURS: Tour[] = [
  {
    key: "bienvenida",
    title: "Bienvenida: un paseo por la aplicación",
    path: "/",
    steps: [
      { target: null, title: "Te damos la bienvenida", text: "Este recorrido dura un minuto y te enseña dónde está cada cosa. Puedes salir cuando quieras con «Saltar» o la tecla Esc, y repetirlo desde el centro de ayuda." },
      { target: "[data-tour=saludo]", title: "Tu día de un vistazo", text: "Arriba ves cuántas cosas tienes hoy y si hay plazos vencidos sin completar. Los botones te llevan a tus tareas, a crear un plazo o a abrir un expediente nuevo." },
      { target: "[data-tour=widgets]", title: "Tu panel, a tu manera", text: "Debajo están los widgets: cifras, próximos plazos, tareas, calendario, horas… Cada persona ve los suyos." },
      { target: "[data-tour=personalizar]", title: "Personalizar el panel", text: "Con «Personalizar panel» puedes añadir, quitar, mover (arrastrando) y cambiar el tamaño de cada widget. Se guarda solo para ti." },
      { target: "[data-tour=menu]", title: "El menú", text: "Todo está agrupado: Trabajo diario (expedientes, clientes, plazos, tareas, horas), Escritos y documentos, Consulta (leyes, conocimiento, calculadoras) y, según tus permisos, Notaría, Facturación y Administración. Los grupos se pliegan con un clic." },
      { target: "[data-tour=buscar]", title: "Buscar cualquier cosa", text: "Pulsa aquí o Ctrl+K (⌘K en Mac) para buscar expedientes, clientes, documentos o ir a cualquier pantalla escribiendo su nombre." },
      { target: "[data-tour=ayuda]", title: "Ayuda en cada pantalla", text: "El botón «?» que verás junto al título de cada pantalla explica para qué sirve, cómo se hace cada cosa y trucos útiles. Algunas pantallas tienen además su propio recorrido." },
      { target: "[data-tour=asistente]", title: "El asistente", text: "Pregúntale por tus expedientes, plazos o cobros, dudas jurídicas o cálculos. También puede hacer cosas por ti, siempre con confirmación: «crea una tarea para mañana: revisar contrato», «registra 2 horas en el EXP-2026-0001…»." },
      { target: "[data-tour=cuenta]", title: "Tu cuenta", text: "Aquí está tu nombre: en «Mi cuenta» cambias la contraseña, activas la verificación en dos pasos, eliges el aspecto (claro u oscuro, colores) y conectas tu calendario. El botón de la luna cambia rápido entre modo claro y oscuro." },
      { target: null, title: "¡Listo!", text: "Un buen primer paso: abre «Expedientes» y crea tu primer expediente (te pedirá elegir o crear el cliente). Si te pierdes, busca el «?» o entra en Ayuda, en el menú." },
    ],
  },
  {
    key: "expedientes",
    title: "Expedientes: la lista",
    path: "/expedientes",
    steps: [
      { target: "[data-tour=titulo]", title: "Todos tus expedientes", text: "Aquí están los expedientes que puedes ver. Los restringidos y confidenciales solo aparecen a quien tiene acceso." },
      { target: "[data-tour=acciones]", title: "Abrir un expediente nuevo", text: "Con «Nuevo expediente» eliges el cliente, la materia, el responsable y cómo se cobra (por horas o por proceso). El número (EXP-AAAA-NNNN) se pone solo." },
      { target: "main form", title: "Filtrar", text: "Busca por número, título o cliente y filtra por estado, materia o responsable." },
      { target: "main table, main ul", title: "La lista", text: "Pulsa en un expediente para abrir su ficha: ahí están sus notas, escritos, documentos, plazos, horas, cobros y facturas." },
    ],
  },
  {
    key: "expediente",
    title: "Dentro de un expediente",
    path: "/expedientes",
    steps: [
      { target: "[data-tour=titulo]", title: "La ficha del expediente", text: "Arriba tienes el número, el título, el cliente y el estado. Desde aquí lo editas o cambias su estado." },
      { target: "[data-tour=pestanas]", title: "Las pestañas", text: "Resumen, Notas, Escritos, Documentos y Agenda son el trabajo del día a día; Horas, Cobro y Facturas, la parte económica. En «Más» están Normativa (leyes citadas), Registros (consultas registrales) y Acceso (quién lo ve). En el móvil es un desplegable." },
      { target: "[data-tour=pestanas]", title: "Escritos y documentos", text: "En «Escritos» generas escritos con los datos ya rellenos, o analizas una demanda recibida con «Contestar una demanda». En «Documentos» subes archivos o generas uno desde una plantilla Word." },
      { target: "[data-tour=pestanas]", title: "Cobro", text: "En «Cobro» ves lo pactado, las etapas, los gastos y la provisión de fondos del cliente (depósitos, gastos pagados con ella y devoluciones)." },
    ],
  },
  {
    key: "tareas",
    title: "Tareas del equipo",
    path: "/tareas",
    steps: [
      { target: "[data-tour=titulo]", title: "Tus tareas", text: "Un tablero con tres columnas: Pendiente, En curso y Hecha. El número del menú «Tareas» es cuántas tienes abiertas (en rojo si alguna está vencida)." },
      { target: "[data-tour=acciones]", title: "Crear una tarea", text: "Con «+ Nueva tarea» la creas en segundos: título, fecha límite, prioridad, expediente (opcional) y a quién se asigna. Si es otra persona, le llega un aviso por correo." },
      { target: "main form", title: "Ver las de otros", text: "Filtra por persona, expediente o prioridad: así ves la carga de trabajo del equipo." },
      { target: null, title: "Mover tareas", text: "Arrastra una tarjeta a otra columna (o usa sus flechas) para cambiar su estado. También puedes decirle al asistente: «marca como hecha la tarea revisar contrato»." },
    ],
  },
  {
    key: "agenda",
    title: "Control de plazos",
    path: "/agenda",
    steps: [
      { target: "[data-tour=titulo]", title: "Plazos, audiencias y reuniones", text: "Todo lo que tiene fecha: plazos procesales, audiencias, reuniones y tareas, con un semáforo según los días hábiles que quedan (se descuentan fines de semana y feriados de Costa Rica)." },
      { target: "[data-tour=acciones]", title: "Añadir un plazo", text: "Con «Nuevo evento» eliges el tipo (plazo, audiencia, reunión), la fecha y hora, el expediente y quién lo atiende. Las audiencias pueden llevar el enlace de la sala virtual." },
      { target: "main table, main ul", title: "Completar con un clic", text: "Marca un plazo como completado desde la lista. Los vencidos sin completar aparecen destacados y también en el panel." },
      { target: null, title: "Avisos por correo y tu calendario", text: "Si el despacho configuró el correo, llegan avisos antes del vencimiento. Y en «Mi cuenta» puedes conectar tus plazos con Google Calendar, Outlook o el iPhone." },
    ],
  },
  {
    key: "horas",
    title: "Horas y cronómetro",
    path: "/horas",
    steps: [
      { target: "[data-tour=titulo]", title: "Registro de horas", text: "Aquí anotas el tiempo trabajado en cada expediente. Las horas facturables se pasan luego a una factura." },
      { target: "main form", title: "Anotar horas a mano", text: "Elige el expediente, la fecha, la duración (por ejemplo 1:30, 90m o 1,5) y qué hiciste. La tarifa se toma sola del expediente o de tu tarifa por hora." },
      { target: null, title: "O con el cronómetro", text: "Desde la ficha de un expediente pulsa «Iniciar cronómetro»: verás una barra arriba con el tiempo corriendo. Al detenerlo, las horas se registran solas (redondeadas según la configuración)." },
    ],
  },
  {
    key: "facturas",
    title: "Facturación",
    path: "/facturas",
    steps: [
      { target: "[data-tour=titulo]", title: "Facturas y cobros", text: "Todas las facturas: borradores, emitidas, pagadas, vencidas y rectificativas, con lo pendiente de cobro." },
      { target: "[data-tour=acciones]", title: "Crear una factura", text: "Con «Nueva factura» eliges cliente y expediente; puedes traer las horas facturables pendientes, los gastos y las etapas del cobro por proceso." },
      { target: "main form", title: "Filtrar", text: "Por estado, cliente o fechas. Desde aquí también se exporta el libro de facturas (CSV) y se configura la factura electrónica de Hacienda." },
      { target: null, title: "Flujo de una factura", text: "Borrador (se puede cambiar) → Emitir (recibe número y ya no se modifica) → Registrar cobro (total o parcial) → Pagada. Si hay un error, se corrige con una factura rectificativa, nunca borrando." },
    ],
  },
  {
    key: "notaria",
    title: "Gestor notarial",
    path: "/notaria",
    steps: [
      { target: "[data-tour=titulo]", title: "Tu protocolo", text: "Cada notario ve solo su protocolo: escrituras numeradas, con su tomo y folio, otorgadas o que no pasaron." },
      { target: "[data-tour=acciones]", title: "Nueva escritura", text: "Con «Redactar con formulario» eliges un modelo notarial (poder, compraventa…) y el texto se redacta solo; con «Registrar escritura» la anotas directamente con su número. Ambos botones aparecen cuando tienes el perfil de notario." },
      { target: null, title: "Índice, testimonios y perfil", text: "En «Índice» preparas el índice quincenal para presentarlo en INDEX; en «Testimonios», los que expides; y en «Perfil», tus datos de notario, tomo y folio actuales." },
    ],
  },
  {
    key: "formularios",
    title: "Formularios y escritos",
    path: "/formularios",
    steps: [
      { target: "[data-tour=titulo]", title: "El catálogo", text: "Escritos de abogado (demandas, contestaciones, recursos, pensiones, amparos…) y escrituras notariales, con modelos pensados para Costa Rica." },
      { target: "main a[href^='/formularios/']", title: "Elegir un formulario", text: "Ábrelo, elige el expediente y los datos del cliente y del expediente se rellenan solos. Completas lo demás y ves el documento al momento." },
      { target: null, title: "Después", text: "El escrito queda guardado en el expediente (pestaña «Escritos»): puedes corregirlo, revisar la ortografía, imprimirlo o descargarlo en Word. Si el despacho tiene sus propios modelos en Word, están en «Plantillas Word»." },
    ],
  },
];

export function getTour(key: string): Tour | null {
  return TOURS.find((t) => t.key === key) ?? null;
}

/* ======================================================================================
 * Guías por pantalla
 * ==================================================================================== */

export const GUIDES: Guide[] = [
  {
    key: "panel",
    title: "Panel de inicio",
    group: "Primeros pasos",
    match: /^\/$/,
    href: "/",
    summary: "Tu resumen del día: lo que tienes hoy, plazos vencidos y los widgets que elijas (cifras, próximos plazos, tareas, calendario, horas, cobros…).",
    tour: "bienvenida",
    howTo: [
      { title: "Personalizar el panel", steps: ["Pulsa «Personalizar panel».", "Arrastra los widgets para cambiar el orden (o usa las flechas ↑ ↓).", "Cambia el tamaño: pequeño (un tercio), mediano (dos tercios) o ancho.", "Quita los que no uses con ✕ y añade otros en «Añadir widgets», abajo.", "Pulsa «Listo». Si quieres volver al diseño original, usa «Restaurar el panel original»."] },
      { title: "Ver lo de esta semana", steps: ["Mira el widget «Mis próximos 14 días» o pulsa «Mis tareas» arriba.", "El aviso en amarillo de plazos vencidos te lleva directamente a ellos."] },
    ],
    tips: ["Cada persona tiene su propio panel: lo que personalices no cambia el de los demás.", "Los widgets de facturación solo los ve quien tiene permiso para ver facturas."],
    keywords: "inicio resumen widgets personalizar tablero",
  },
  {
    key: "expedientes",
    title: "Expedientes",
    group: "Trabajo diario",
    match: /^\/expedientes(\/nuevo)?$/,
    href: "/expedientes",
    summary: "La lista de asuntos del despacho que puedes ver, con su número, cliente, materia, estado y responsable.",
    tour: "expedientes",
    howTo: [
      { title: "Abrir un expediente nuevo", steps: ["Pulsa «Nuevo expediente».", "Elige el cliente (si no existe, créalo antes en «Mis clientes»).", "Escribe el título del asunto y elige la materia y el responsable.", "Indica cómo se cobra: por horas (con tarifa propia o la del abogado) o por proceso (monto total; el tarifario sugiere un precio).", "Si es delicado, elige la visibilidad: restringido o confidencial.", "Guarda: el número EXP-AAAA-NNNN se asigna solo y te propone generar el primer escrito."] },
      { title: "Aplicar una plantilla de proceso", steps: ["Dentro del expediente, usa «Aplicar plantilla de proceso».", "Elige el tipo de proceso: se crean de golpe sus tareas y plazos habituales, con fechas calculadas en días hábiles."] },
      { title: "Encontrar un expediente", steps: ["Escribe parte del número, título o cliente en el buscador y pulsa «Filtrar».", "O pulsa Ctrl+K desde cualquier pantalla y escribe."] },
    ],
    faq: [
      { q: "¿Qué diferencia hay entre abierto, restringido y confidencial?", a: "Abierto: lo ve todo el equipo. Restringido: solo el responsable, los miembros añadidos y quien tenga el permiso «ver restringidos». Confidencial: solo el responsable y los miembros, ni siquiera el administrador." },
      { q: "No encuentro un expediente que sé que existe", a: "Puede ser restringido o confidencial y no tener acceso. Pide al responsable que te añada como miembro en la pestaña «Acceso»." },
    ],
    keywords: "caso asunto expediente nuevo crear abrir numero filtro buscar visibilidad confidencial restringido",
  },
  {
    key: "expediente",
    title: "Ficha del expediente",
    group: "Trabajo diario",
    match: /^\/expedientes\/\d+(\/editar|\/plantilla)?$/,
    summary: "Todo lo de un asunto en un solo sitio, organizado en pestañas: notas, escritos, documentos, agenda, leyes citadas, horas, cobro, facturas y acceso.",
    tour: "expediente",
    howTo: [
      { title: "Añadir una nota", steps: ["Abre la pestaña «Notas».", "Escribe la nota y guarda. Queda con tu nombre y la fecha.", "O díselo al asistente: «añade una nota al EXP-2026-0001: llamó el cliente»."] },
      { title: "Generar un escrito con los datos ya puestos", steps: ["Pestaña «Escritos» → «Generar escrito».", "Elige el formulario: el cliente, el juzgado y el número de expediente se rellenan solos.", "Completa el resto y guarda. Puedes descargarlo en Word o PDF."] },
      { title: "Contestar una demanda recibida", steps: ["Sube la demanda en «Documentos» (PDF o Word).", "En «Escritos», pulsa «Contestar una demanda» y elige el documento.", "La app separa hechos, pretensiones y prueba, calcula el plazo y te avisa de lo que hay que vigilar.", "Responde cada hecho y pulsa «Redactar la contestación»."] },
      { title: "Subir documentos o generarlos desde Word", steps: ["Pestaña «Documentos» → elige el archivo (hasta 25 MB).", "Para usar un modelo del despacho, pulsa «Generar desde plantilla Word»."] },
      { title: "Registrar horas o usar el cronómetro", steps: ["Pestaña «Horas»: anota la duración y lo que hiciste.", "O pulsa «Iniciar cronómetro» y detenlo al terminar: las horas se registran solas."] },
      { title: "Provisión de fondos del cliente", steps: ["Pestaña «Cobro» → sección de provisión de fondos.", "Registra los depósitos del cliente, los gastos que pagas con ellos y las devoluciones.", "Puedes fijar un saldo mínimo para recibir aviso cuando baje y descargar el recibo de cada movimiento."] },
      { title: "Dar acceso a otra persona", steps: ["Pestaña «Acceso» (en «Más»).", "Cambia la visibilidad o añade miembros. Cada cambio queda en el historial."] },
      { title: "Cambiar el estado", steps: ["Usa el selector de estado de la ficha: abierto, en curso, en espera, cerrado o archivado.", "O díselo al asistente: «pasa el EXP-2026-0001 a en espera»."] },
    ],
    tips: ["El asistente recuerda el expediente del que hablas: después de preguntar por uno, puedes decir «registra 1 hora en ese expediente».", "La pestaña «Normativa» guarda las leyes citadas y se usan solas como fundamento de derecho en los escritos."],
    keywords: "ficha pestañas notas escritos documentos agenda horas cobro facturas acceso cronometro provision fondos estado",
  },
  {
    key: "contestar",
    title: "Contestar una demanda",
    group: "Escritos y documentos",
    match: /^\/expedientes\/\d+\/contestar/,
    summary: "Lee la demanda que presentó la otra parte (PDF, Word o texto pegado), la desglosa y te guía para contestarla hecho por hecho, sin enviar nada fuera de la app.",
    howTo: [
      { title: "Analizar la demanda", steps: ["Sube la demanda a los documentos del expediente.", "Elige el documento y pulsa «Analizar la demanda». Si es un escaneo sin texto, pega el texto.", "Revisa «Lo que entendí»: tipo de proceso, partes, hechos, pretensiones, prueba y estimación."] },
      { title: "Análisis punto por punto", steps: ["Cada hecho lleva una etiqueta: «Sin controversia» (datos del Registro, conviene admitirlos), «Confirmar con el cliente», «Controversia parcial», «Controvertido» o «No es un hecho» (citas de normas).", "Abre «Qué afirma, punto por punto» para ver cada afirmación del hecho clasificada: dato registral, valoración, imputación a tu cliente, bienes…", "En «Opciones de respuesta» tienes respuestas ya redactadas; la recomendada va marcada. Pulsa «Usar esta respuesta» y completa los [PENDIENTE].", "Haz lo mismo con las pretensiones (te dice si cada una te favorece) y con las advertencias sobre la prueba (testigos con posible parentesco, prueba genérica).", "«Aplicar las respuestas recomendadas a lo que falta» rellena de golpe lo que aún no respondiste, sin tocar lo ya hecho."] },
      { title: "Responder y redactar", steps: ["Indica la fecha de notificación: se calcula el vencimiento en días hábiles y puedes añadirlo al Control de plazos.", "Responde cada hecho (lo admito, con variantes, lo rechazo, lo desconozco, no es un hecho) y explica por qué.", "Marca tu posición sobre las pretensiones (me opongo, me opongo en parte, me allano), las excepciones y la prueba.", "Pulsa «Redactar la contestación»: los hechos sin responder salen como [PENDIENTE]."] },
    ],
    tips: ["Todo se guarda solo mientras trabajas.", "Las citas a artículos que no existen en la ley vigente se marcan en rojo.", "Las propuestas son un punto de partida: la app no conoce la versión de tu cliente. Revisa cada [PENDIENTE] antes de presentar.", "Si analizaste la demanda antes de una mejora, pulsa «Volver a leer la demanda»: tus respuestas se conservan."],
    faq: [{ q: "¿Cómo decide si un hecho es controvertido?", a: "Divide el hecho en frases y busca señales: datos con tomo, folio o certificación son objetivos; palabras como «insoportable» o «perdimos el respeto» son valoraciones; «medidas de protección» o «agresión» son imputaciones a tu cliente; las leyes y artículos citados son fundamento jurídico. Todo es lectura por reglas, sin enviar nada fuera." }],
    keywords: "demanda contestacion contestar analizar hechos pretensiones excepciones plazo controversia controvertido punto por punto allanamiento",
  },
  {
    key: "clientes",
    title: "Mis clientes",
    group: "Trabajo diario",
    match: /^\/clientes/,
    href: "/clientes",
    summary: "Las fichas de tus clientes (personas o empresas) con su identificación, datos de contacto, expedientes y facturas.",
    howTo: [
      { title: "Dar de alta un cliente", steps: ["Pulsa «Nuevo cliente».", "Elige persona física o empresa y escribe el número de identificación.", "Pulsa «Buscar en Hacienda» para traer el nombre (si está inscrito).", "Completa los datos obligatorios (*) y guarda."] },
      { title: "Darle acceso a su portal", steps: ["Abre la ficha del cliente → sección «Portal del cliente».", "Crea un enlace (dura hasta 90 días) y envíaselo por correo o WhatsApp.", "Marca qué expedientes y documentos quieres compartir. El cliente solo ve eso, nunca la app del despacho.", "Puedes revocar el enlace en cualquier momento."] },
      { title: "Cliente confidencial", steps: ["Al crearlo, elige «Confidencial» (necesitas el permiso para gestionar clientes).", "Solo lo verán tú y quien tenga acceso a sus expedientes."] },
    ],
    faq: [
      { q: "«Buscar en Hacienda» no encuentra el nombre", a: "Hacienda solo responde por quien está inscrito como contribuyente. Si no aparece, escribe el nombre a mano." },
      { q: "¿Puedo borrar un cliente?", a: "Solo si no tiene expedientes ni facturas. Si los tiene, ciérralos o archívalos." },
    ],
    keywords: "cliente alta nuevo cedula hacienda identificacion portal enlace confidencial",
  },
  {
    key: "solicitudes",
    title: "Solicitudes de nuevos clientes",
    group: "Trabajo diario",
    match: /^\/solicitudes/,
    href: "/solicitudes",
    permission: "solicitudes.gestionar",
    summary: "Las consultas que llegan por el formulario público. Se revisan los conflictos de interés y se convierten en cliente y expediente con un clic.",
    howTo: [
      { title: "Activar el formulario público", steps: ["Abre «Ajustes del formulario», marca «Recibir solicitudes» y guarda.", "Copia el enlace y compártelo en tu web, redes o WhatsApp."] },
      { title: "Revisar y aceptar una solicitud", steps: ["Abre la solicitud: verás el caso, los documentos y la revisión de conflictos.", "Si hay coincidencias, compruébalas (pueden ser homónimos).", "Pulsa «Aceptar: crear cliente y expediente», completa los datos y confirma."] },
      { title: "Descartar", steps: ["Escribe el motivo (interno) y pulsa «Descartar solicitud». Se borra sola a los 6 meses."] },
    ],
    keywords: "solicitud consulta formulario publico conflicto interes aceptar descartar nuevo cliente",
  },
  {
    key: "agenda",
    title: "Control de plazos",
    group: "Trabajo diario",
    match: /^\/agenda/,
    href: "/agenda",
    summary: "Plazos procesales, audiencias, reuniones y tareas con su semáforo de días hábiles restantes.",
    tour: "agenda",
    howTo: [
      { title: "Añadir un plazo o una audiencia", steps: ["Pulsa «Nuevo evento».", "Elige el tipo, el título, la fecha y la hora.", "Asócialo a un expediente y elige quién lo atiende.", "En audiencias puedes indicar el tipo, la modalidad y el enlace de la sala virtual."] },
      { title: "Calcular un vencimiento", steps: ["En «Herramientas» → «Vencimiento de un plazo procesal» indicas la fecha de notificación y los días.", "O pregúntale al asistente: «me notificaron el 20/11, ¿cuándo vence la apelación?»."] },
      { title: "Verlos en tu calendario", steps: ["En «Mi cuenta» → calendario, crea tu enlace privado y añádelo en Google Calendar, Outlook o el iPhone."] },
    ],
    tips: ["El semáforo cuenta días hábiles: no incluye fines de semana ni feriados de Costa Rica.", "Los avisos por correo salen solo si el despacho configuró el correo en «Recordatorios»."],
    keywords: "plazo plazos audiencia reunion agenda calendario vencimiento semaforo dias habiles feriado",
  },
  {
    key: "tareas",
    title: "Tareas",
    group: "Trabajo diario",
    match: /^\/tareas/,
    href: "/tareas",
    summary: "El tablero de tareas del equipo: pendientes, en curso y hechas, con prioridad, fecha límite y persona asignada.",
    tour: "tareas",
    howTo: [
      { title: "Crear y asignar una tarea", steps: ["Pulsa «+ Nueva tarea».", "Escribe qué hay que hacer, la fecha límite y la prioridad.", "Elige el expediente (opcional) y a quién se asigna. Si es otra persona, recibe un aviso por correo."] },
      { title: "Con el asistente", steps: ["Escribe en el chat: «crea una tarea urgente para el viernes asignada a Lucía: revisar contrato».", "Revisa la tarjeta y confirma."] },
      { title: "Cambiar el estado", steps: ["Arrastra la tarjeta a otra columna o usa sus flechas."] },
    ],
    keywords: "tarea tareas tablero asignar prioridad pendiente hecha equipo",
  },
  {
    key: "horas",
    title: "Horas",
    group: "Trabajo diario",
    match: /^\/horas/,
    href: "/horas",
    summary: "El registro del tiempo trabajado por expediente, a mano o con el cronómetro: la base de la facturación por horas.",
    tour: "horas",
    howTo: [
      { title: "Registrar horas", steps: ["Elige el expediente, la fecha y la duración (1:30, 90m, 1h 15m o 1,5).", "Describe el trabajo y marca si es facturable.", "La tarifa se toma del expediente o de tu tarifa por hora."] },
      { title: "Usar el cronómetro", steps: ["En la ficha del expediente pulsa «Iniciar cronómetro» (o dile al asistente «inicia el cronómetro en el EXP-…»).", "Puedes pausarlo y reanudarlo desde la barra superior.", "Al detenerlo, describe el trabajo: las horas se registran redondeadas al tramo configurado."] },
      { title: "Corregir o borrar", steps: ["Pulsa «Editar» en la entrada. Solo se pueden cambiar las horas que aún no están en una factura."] },
    ],
    keywords: "horas tiempo cronometro registrar facturable tarifa",
  },
  {
    key: "formularios",
    title: "Formularios y escritos",
    group: "Escritos y documentos",
    match: /^\/(formularios(?!\/plantillas)|escritos)/,
    href: "/formularios",
    summary: "Modelos de escritos de abogado y escrituras notariales que se rellenan con los datos del expediente y del cliente.",
    tour: "formularios",
    howTo: [
      { title: "Generar un escrito", steps: ["Abre el formulario que necesitas.", "Elige el expediente: los datos se rellenan solos.", "Completa el resto, revisa la vista previa y pulsa «Generar».", "Desde el escrito puedes «Corregir», revisar la ortografía, imprimir o descargar en Word o PDF."] },
      { title: "Citar leyes en el fundamento de derecho", steps: ["En el campo de fundamento, busca un artículo e insértalo.", "Las leyes citadas en el expediente (pestaña «Normativa») se añaden solas."] },
    ],
    keywords: "formulario escrito modelo demanda contestacion recurso redactar generar word pdf ortografia",
  },
  {
    key: "plantillas-word",
    title: "Plantillas Word propias",
    group: "Escritos y documentos",
    match: /^\/formularios\/plantillas|^\/expedientes\/\d+\/plantilla-word/,
    href: "/formularios/plantillas",
    summary: "Los modelos .docx del despacho, con campos entre llaves ({cliente}, {expediente}, {fecha}…) que se rellenan solos.",
    howTo: [
      { title: "Preparar una plantilla", steps: ["En Word, escribe los campos entre llaves donde quieras los datos: {cliente}, {cliente_cedula}, {expediente}, {juzgado}, {fecha}… (la lista completa está en la pantalla).", "También puedes inventar campos propios ({monto_reclamado}): se preguntan al generar.", "Guárdalo como .docx (sin macros) y súbelo en «Plantillas Word»."] },
      { title: "Generar un documento", steps: ["En el expediente → «Documentos» → «Generar desde plantilla Word».", "Elige la plantilla, completa los campos propios y genera: el Word queda en los documentos del expediente."] },
    ],
    faq: [{ q: "Me da error al subir la plantilla", a: "Suele ser una llave sin cerrar o un campo con espacios. El mensaje te indica cuál. Escribe los campos solo con letras, números y guion bajo." }],
    keywords: "plantilla word docx campos llaves modelo propio",
  },
  {
    key: "documentos",
    title: "Documentos",
    group: "Escritos y documentos",
    match: /^\/documentos/,
    href: "/documentos",
    summary: "Todos los documentos de los expedientes que puedes ver, con visor integrado para PDF, Word e imágenes.",
    howTo: [
      { title: "Subir un documento", steps: ["Pulsa «Subir documento», elige el expediente y el archivo (hasta 25 MB).", "Ponle una categoría si quieres (prueba, notificación, contrato…)."] },
      { title: "Compartirlo con el cliente", steps: ["En la ficha del expediente, marca el documento como compartido en el portal (el expediente también debe estar compartido)."] },
    ],
    keywords: "documento archivo subir pdf word visor compartir",
  },
  {
    key: "normativa",
    title: "Normativa",
    group: "Consulta",
    match: /^\/normativa/,
    href: "/normativa",
    summary: "Las leyes de Costa Rica cargadas en la app (texto vigente de SINALEVI), con buscador por artículo o tema.",
    howTo: [
      { title: "Buscar un artículo", steps: ["Escribe el tema o «artículo 29 código de trabajo» y pulsa «Buscar».", "Abre la ley para leerla completa, por títulos y capítulos."] },
      { title: "Citar en un expediente", steps: ["Desde el artículo, usa «Citar» y elige el expediente: queda en su pestaña «Normativa» y en el fundamento de los escritos."] },
      { title: "Cargar otra ley", steps: ["En «Cargar», pega el texto de SINALEVI: se separa en artículos solo."] },
    ],
    keywords: "ley leyes codigo articulo normativa sinalevi citar fundamento",
  },
  {
    key: "conocimiento",
    title: "Base de conocimiento",
    group: "Consulta",
    match: /^\/conocimiento/,
    href: "/conocimiento",
    summary: "Guías y criterios del despacho (plazos, procedimientos, jurisprudencia). El asistente las usa para responder.",
    howTo: [
      { title: "Añadir una entrada", steps: ["Pulsa «Nueva entrada», escribe el título, el contenido y las referencias (artículos, sentencias).", "Márcala como revisada cuando alguien del despacho la confirme."] },
    ],
    tips: ["Lo que escribas aquí lo usa el asistente para responder dudas jurídicas, indicando la fuente."],
    keywords: "conocimiento guia criterio jurisprudencia entrada",
  },
  {
    key: "herramientas",
    title: "Herramientas y calculadoras",
    group: "Consulta",
    match: /^\/herramientas/,
    href: "/herramientas",
    summary: "Calculadoras: liquidación laboral, vencimiento de plazos procesales, prescripción (civil, penal y de la pena), pensión alimentaria y plazo del amparo.",
    howTo: [{ title: "Calcular un vencimiento", steps: ["En «Vencimiento de un plazo procesal», indica la fecha de notificación y el plazo.", "El resultado explica cómo se contó (día hábil siguiente, feriados que se saltaron)."] }],
    keywords: "calculadora liquidacion prescripcion pension plazo vencimiento amparo",
  },
  {
    key: "reportes",
    title: "Reportes",
    group: "Consulta",
    match: /^\/reportes/,
    href: "/reportes",
    summary: "Estadísticas del despacho: expedientes por materia, horas, facturación por cliente, cartera pendiente por antigüedad, rentabilidad y provisiones de fondos.",
    howTo: [{ title: "Ver un reporte", steps: ["Elige el periodo y pulsa «Ver reporte».", "Solo se incluyen los expedientes a los que tienes acceso."] }],
    keywords: "reporte estadistica cartera rentabilidad facturacion",
  },
  {
    key: "notaria",
    title: "Gestor notarial",
    group: "Notaría",
    match: /^\/notaria/,
    href: "/notaria",
    permission: "notaria.usar",
    summary: "Tu protocolo notarial: escrituras con número, tomo y folio, comparecientes, testimonios e índice quincenal.",
    tour: "notaria",
    howTo: [
      { title: "Configurar tu perfil de notario", steps: ["En «Perfil», escribe tus datos, el tomo actual y el próximo folio."] },
      { title: "Registrar una escritura", steps: ["Pulsa «Redactar con formulario» (la escritura se anota sola en el protocolo con el siguiente número) o «Registrar escritura» para anotarla a mano.", "Añade los comparecientes y marca si se otorgó o no pasó."] },
      { title: "Índice quincenal", steps: ["En «Índice», revisa las escrituras de la quincena y copia los datos para presentarlos en INDEX.", "Anota la fecha de presentación: el panel te avisa si queda alguno pendiente."] },
    ],
    keywords: "notario notaria escritura protocolo tomo folio indice testimonio index",
  },
  {
    key: "facturas",
    title: "Facturas",
    group: "Facturación",
    match: /^\/facturas/,
    href: "/facturas",
    permission: "facturacion.ver",
    summary: "Facturas y cobros: borradores, emitidas, pagadas, vencidas y rectificativas; PDF, factura electrónica de Hacienda y exportación.",
    tour: "facturas",
    howTo: [
      { title: "Hacer una factura", steps: ["Pulsa «Nueva factura» y elige cliente y expediente.", "Añade las horas facturables pendientes, los gastos o las etapas del cobro por proceso, o líneas libres.", "Revisa el IVA y pulsa «Emitir factura»: recibe número y ya no se puede modificar."] },
      { title: "Registrar un cobro", steps: ["En la factura, «Registrar cobro»: monto, fecha y forma de pago (también desde la provisión de fondos del cliente).", "Cuando se cobra todo, pasa a «Pagada»."] },
      { title: "Corregir una factura emitida", steps: ["Pulsa «Rectificar esta factura»: se crea un borrador de rectificativa con el motivo.", "Emítela. La original queda como «Rectificada»."] },
      { title: "Factura electrónica (Hacienda)", steps: ["En «Factura electrónica», configura los datos del emisor y la llave criptográfica.", "En cada factura emitida, «Enviar a Hacienda» y consulta su estado."] },
    ],
    faq: [{ q: "¿Por qué no puedo borrar una factura emitida?", a: "Por ley y por control interno, una factura emitida no se borra ni se modifica: se corrige con una rectificativa." }],
    keywords: "factura facturar cobro pago emitir rectificativa pdf iva hacienda electronica exportar csv",
  },
  {
    key: "tarifario",
    title: "Tarifario",
    group: "Facturación",
    match: /^\/tarifario/,
    href: "/tarifario",
    summary: "Los precios del despacho por servicio, comparados con los mínimos del arancel oficial del Colegio de Abogados.",
    howTo: [{ title: "Añadir un servicio", steps: ["Pulsa «Añadir»: nombre, forma de cobro (fijo, por horas, porcentaje de la cuantía con mínimo) y etapas de pago si las hay.", "Si queda por debajo del arancel, verás un aviso."] }],
    keywords: "tarifario precio honorarios arancel servicio cobrar",
  },
  {
    key: "recordatorios",
    title: "Recordatorios por correo",
    group: "Administración",
    match: /^\/recordatorios/,
    href: "/recordatorios",
    permission: "recordatorios.gestionar",
    summary: "La configuración de los avisos por correo de plazos, audiencias y tareas, y su historial.",
    howTo: [{ title: "Activar los avisos", steps: ["Hay que configurar el servidor de correo (SMTP) en el alojamiento de la app.", "Aquí ves si está configurado, los avisos pendientes y el historial de envíos."] }],
    keywords: "recordatorio aviso correo email smtp",
  },
  {
    key: "equipo",
    title: "Equipo y roles",
    group: "Administración",
    match: /^\/equipo/,
    href: "/equipo",
    permission: "equipo.gestionar",
    summary: "Las personas con acceso a la app y lo que puede hacer cada rol.",
    howTo: [
      { title: "Añadir a una persona", steps: ["Pulsa «Añadir usuario», escribe su nombre, correo y rol.", "Dale la contraseña provisional: deberá cambiarla al entrar."] },
      { title: "Crear un rol a medida", steps: ["Pulsa «Crear un rol» y marca los permisos (ver facturas, emitir, notaría, gestionar clientes…)."] },
      { title: "Si alguien pierde el móvil", steps: ["En su ficha: «Quitar su verificación en dos pasos». Y si sospechas de un acceso, «Cerrar sus sesiones»."] },
    ],
    keywords: "equipo usuario rol permiso añadir contraseña desactivar",
  },
  {
    key: "seguridad",
    title: "Seguridad",
    group: "Administración",
    match: /^\/seguridad/,
    href: "/seguridad",
    permission: "seguridad.ver",
    summary: "El registro de seguridad (entradas, intentos fallidos, cambios de permisos), los cambios y borrados de datos y las copias de seguridad.",
    howTo: [
      { title: "Revisar la actividad", steps: ["Filtra por tipo de evento o persona. Los eventos importantes aparecen destacados."] },
      { title: "Copias de seguridad", steps: ["En «Copias de seguridad» ves las copias diarias y puedes descargar una."] },
    ],
    keywords: "seguridad registro auditoria copia respaldo backup cambios borrados",
  },
  {
    key: "cuenta",
    title: "Mi cuenta",
    group: "Primeros pasos",
    match: /^\/cuenta/,
    href: "/cuenta",
    summary: "Tu contraseña, la verificación en dos pasos, el aspecto de la app, tus sesiones abiertas y el enlace a tu calendario.",
    howTo: [
      { title: "Activar la verificación en dos pasos", steps: ["Pulsa «Activar la verificación en dos pasos».", "Escanea el código con una app autenticadora (Google Authenticator, Microsoft Authenticator…).", "Escribe el código de 6 cifras y guarda los códigos de recuperación en un lugar seguro."] },
      { title: "Cambiar el aspecto", steps: ["En «Apariencia», elige modo claro, oscuro o automático, la paleta de colores y el estilo del menú."] },
      { title: "Ver tus plazos en Google Calendar u Outlook", steps: ["Crea tu enlace privado de calendario y sigue «Cómo añadirlo». Si lo compartiste por error, revócalo."] },
    ],
    keywords: "cuenta contraseña dos pasos mfa verificacion apariencia oscuro tema calendario sesion",
  },
  {
    key: "asistente",
    title: "El asistente",
    group: "Primeros pasos",
    match: /^$/,
    summary: "El chat de abajo a la derecha: responde sobre tus expedientes, plazos y cobros, dudas jurídicas y cálculos, y puede hacer cosas por ti con tu confirmación.",
    howTo: [
      { title: "Preguntar", steps: ["«Resumen», «plazos de esta semana», «¿cuánto debe Gerson?», «estado del EXP-2026-0001».", "Dudas jurídicas: «¿cuánto tengo para apelar una sentencia?», «artículo 29 del código de trabajo».", "Cálculos: «liquidación de 3 años con salario de 600 000»."] },
      { title: "Pedirle que haga algo", steps: ["«Crea una tarea urgente para mañana a las 3 pm asignada a Lucía: revisar contrato».", "«Agenda una audiencia preliminar el 5/12 a las 9 en el EXP-2026-0001».", "«Registra hora y media en ese expediente: redacción de demanda».", "«Inicia el cronómetro…», «añade una nota…», «marca como hecha la tarea…», «pasa el EXP… a en espera».", "Te muestra lo que entendió: corrige lo que haga falta y confirma."] },
    ],
    tips: ["Respeta tus permisos: no ve ni toca lo que tú no puedes ver.", "Entiende faltas de ortografía y fechas como «pasado mañana» o «el próximo viernes»."],
    keywords: "asistente chat preguntar comando accion",
  },
];

/** Guía de la pantalla actual (la más concreta que encaje). */
export function guideFor(pathname: string): Guide | null {
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return GUIDES.find((g) => g.match.test(path)) ?? null;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Búsqueda en todas las guías (título, resumen, pasos, preguntas y palabras clave). */
export function searchGuides(query: string, guides: Guide[] = GUIDES): { guide: Guide; score: number; match?: string }[] {
  const words = fold(query).split(/\s+/).filter((w) => w.length >= 3);
  if (!words.length) return [];
  const out: { guide: Guide; score: number; match?: string }[] = [];
  for (const g of guides) {
    let score = 0;
    let match: string | undefined;
    for (const w of words) {
      if (fold(g.title).includes(w)) score += 5;
      if (fold(g.keywords ?? "").includes(w)) score += 3;
      if (fold(g.summary).includes(w)) score += 2;
      for (const h of g.howTo) {
        if (fold(h.title).includes(w)) {
          score += 4;
          match ??= h.title;
        }
      }
      for (const f of g.faq ?? []) {
        if (fold(f.q).includes(w)) {
          score += 3;
          match ??= f.q;
        }
      }
    }
    if (score > 0) out.push({ guide: g, score, match });
  }
  return out.sort((a, b) => b.score - a.score);
}
