import { BLANK, lines, longDate, val, type Block, type Field, type FormTemplate, type Values } from "./engine";

/**
 * Formularios de Costa Rica. Son modelos base para ahorrar tiempo: el despacho debe revisarlos y
 * adaptarlos a cada caso y a la normativa vigente (Código Procesal Civil, Código de Trabajo, Código
 * Notarial…). Los escritos de abogado NO llevan datos de protocolo (tomo, folio, asiento): eso es
 * exclusivo de las escrituras notariales.
 */

// ---------- Piezas comunes de los escritos de abogado ----------

const F = {
  juzgado: { name: "juzgado", label: "Despacho judicial", type: "text", auto: "expediente.juzgado", hint: "Por ejemplo: Juzgado Civil de San José", required: true } as Field,
  expediente: { name: "expediente", label: "Número de expediente judicial", type: "text", auto: "expediente.numero", hint: "Formato 26-000123-0180-CI" } as Field,
  cliente: { name: "cliente", label: "Nombre completo del cliente", type: "text", auto: "cliente.nombre", required: true } as Field,
  cedula: { name: "cedula", label: "Cédula del cliente", type: "text", auto: "cliente.cedula" } as Field,
  estadoCivil: { name: "estadoCivil", label: "Estado civil", type: "text", auto: "cliente.estadoCivil" } as Field,
  profesion: { name: "profesion", label: "Profesión u oficio", type: "text" } as Field,
  domicilio: { name: "domicilio", label: "Vecino de (domicilio)", type: "text", auto: "cliente.domicilio" } as Field,
  contraparte: { name: "contraparte", label: "Parte contraria", type: "text", auto: "expediente.contraparte" } as Field,
  abogado: { name: "abogado", label: "Abogado(a) que firma", type: "text", auto: "abogado.nombre", required: true } as Field,
  carne: { name: "carne", label: "Carné del Colegio de Abogados", type: "text", auto: "abogado.carne" } as Field,
  notificaciones: { name: "notificaciones", label: "Medio para notificaciones", type: "text", auto: "abogado.correo", hint: "Correo electrónico o fax" } as Field,
  lugar: { name: "lugar", label: "Lugar", type: "text", hint: "Ciudad donde se firma" } as Field,
  fecha: { name: "fecha", label: "Fecha", type: "date", auto: "fecha" } as Field,
};

const calidades = (v: Values) =>
  `${val(v, "cliente")}, mayor, ${val(v, "estadoCivil")}, ${val(v, "profesion")}, vecino(a) de ${val(v, "domicilio")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}`;

const encabezado = (v: Values, proceso: string): Block[] => [
  { t: "encabezado", text: `SEÑOR(A) JUEZ(A) DEL ${val(v, "juzgado").toUpperCase()}` },
  ...(v.expediente?.trim() ? [{ t: "encabezado", text: `Expediente: ${v.expediente.trim()}` } as Block] : []),
  { t: "encabezado", text: `Proceso: ${proceso}` },
];

const cierre = (v: Values): Block[] => [
  { t: "seccion", text: "NOTIFICACIONES" },
  { t: "p", text: `Señalo para atender notificaciones el siguiente medio: ${val(v, "notificaciones")}.` },
  { t: "p", text: `${val(v, "lugar")}, ${longDate(v.fecha ?? "")}.` },
  { t: "firma", lines: [val(v, "cliente"), "", `Lic./Licda. ${val(v, "abogado")}`, `Carné del Colegio de Abogados ${val(v, "carne")}`] },
];

const listOr = (v: Values, name: string): Block => {
  const items = lines(v, name);
  return items.length ? { t: "ordinales", items } : { t: "p", text: BLANK };
};

// ---------- Escritos de abogado ----------

const demandaOrdinaria: FormTemplate = {
  key: "demanda-ordinaria-civil",
  kind: "escrito",
  category: "Civil",
  title: "Demanda en proceso ordinario civil",
  description: "Demanda con hechos, pretensión, prueba, fundamento de derecho y estimación.",
  fields: [F.juzgado, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio, F.contraparte,
    { name: "calidadesContraparte", label: "Calidades de la parte contraria", type: "text", hint: "Cédula, domicilio…" },
    { name: "hechos", label: "Descripción del caso: hechos", type: "list", required: true, hint: "Un hecho por línea. Se numeran solos (PRIMERO, SEGUNDO…)." },
    { name: "pretension", label: "Pretensión", type: "list", required: true, hint: "Lo que se pide al juzgado, una petición por línea." },
    { name: "prueba", label: "Prueba", type: "list", hint: "Documental, testimonial, pericial… una por línea." },
    { name: "derecho", label: "Fundamento de derecho", type: "textarea" },
    { name: "estimacion", label: "Estimación de la demanda", type: "text", hint: "Monto en colones" },
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha],
  render: (v) => [
    ...encabezado(v, "Ordinario civil"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, con el debido respeto interpongo DEMANDA ORDINARIA en contra de ${val(v, "contraparte")}${v.calidadesContraparte?.trim() ? `, ${v.calidadesContraparte.trim()}` : ""}, con fundamento en lo siguiente:` },
    { t: "seccion", text: "HECHOS" }, listOr(v, "hechos"),
    { t: "seccion", text: "PRETENSIÓN" }, { t: "p", text: "Con base en lo expuesto, solicito que en sentencia se declare:" }, listOr(v, "pretension"),
    { t: "seccion", text: "PRUEBA" }, listOr(v, "prueba"),
    { t: "seccion", text: "FUNDAMENTO DE DERECHO" }, { t: "p", text: val(v, "derecho") },
    { t: "seccion", text: "ESTIMACIÓN" }, { t: "p", text: `Estimo la presente demanda en la suma de ${val(v, "estimacion")}.` },
    ...cierre(v),
  ],
};

const demandaLaboral: FormTemplate = {
  key: "demanda-laboral",
  kind: "escrito",
  category: "Laboral",
  title: "Demanda laboral (derechos laborales)",
  description: "Despido, preaviso, cesantía, vacaciones, aguinaldo y salarios adeudados.",
  fields: [
    { ...F.juzgado, hint: "Por ejemplo: Juzgado de Trabajo del Primer Circuito Judicial de San José" },
    F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio,
    { ...F.contraparte, label: "Parte patronal demandada" },
    { name: "inicio", label: "Fecha de inicio de la relación laboral", type: "date" },
    { name: "fin", label: "Fecha de terminación", type: "date" },
    { name: "puesto", label: "Puesto desempeñado", type: "text" },
    { name: "salario", label: "Último salario mensual", type: "text" },
    { name: "hechos", label: "Descripción del caso: hechos", type: "list", required: true, hint: "Un hecho por línea. Se numeran solos." },
    { name: "pretension", label: "Pretensiones", type: "list", required: true, hint: "Preaviso, cesantía, vacaciones, aguinaldo, salarios adeudados, intereses, costas… una por línea." },
    { name: "prueba", label: "Prueba", type: "list" },
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezado(v, "Ordinario laboral"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, con el debido respeto interpongo DEMANDA ORDINARIA LABORAL en contra de ${val(v, "contraparte")}, por los siguientes hechos y razones:` },
    { t: "seccion", text: "HECHOS" },
    { t: "p", text: `Laboré para la parte demandada desde el ${longDate(v.inicio ?? "")} hasta el ${longDate(v.fin ?? "")}, en el puesto de ${val(v, "puesto")}, con un último salario mensual de ${val(v, "salario")}.` },
    listOr(v, "hechos"),
    { t: "seccion", text: "PRETENSIONES" }, { t: "p", text: "Solicito que en sentencia se condene a la parte demandada al pago de:" }, listOr(v, "pretension"),
    { t: "seccion", text: "PRUEBA" }, listOr(v, "prueba"),
    ...cierre(v),
  ],
};

const contestacion: FormTemplate = {
  key: "contestacion-demanda",
  kind: "escrito",
  category: "Civil",
  title: "Contestación de demanda",
  description: "Respuesta a cada hecho, excepciones y prueba.",
  fields: [F.juzgado, F.expediente, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio, { ...F.contraparte, label: "Parte actora" },
    { name: "hechos", label: "Respuesta a los hechos", type: "list", required: true, hint: "Una respuesta por línea, en el mismo orden que la demanda: «Es cierto», «No es cierto porque…»." },
    { name: "excepciones", label: "Excepciones", type: "list", hint: "Por ejemplo: falta de derecho, prescripción… una por línea." },
    { name: "prueba", label: "Prueba", type: "list" },
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha],
  render: (v) => [
    ...encabezado(v, "Ordinario"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, en mi condición de parte demandada en el proceso que en mi contra sigue ${val(v, "contraparte")}, contesto la demanda en los siguientes términos:` },
    { t: "seccion", text: "SOBRE LOS HECHOS" }, listOr(v, "hechos"),
    { t: "seccion", text: "EXCEPCIONES" }, listOr(v, "excepciones"),
    { t: "seccion", text: "PRUEBA" }, listOr(v, "prueba"),
    { t: "seccion", text: "PETITORIA" }, { t: "p", text: "Solicito que se acojan las excepciones opuestas y se declare sin lugar la demanda en todos sus extremos, con condena en costas a la parte actora." },
    ...cierre(v),
  ],
};

const recurso: FormTemplate = {
  key: "recurso-revocatoria-apelacion",
  kind: "escrito",
  category: "Recursos",
  title: "Recurso de revocatoria con apelación en subsidio",
  description: "Contra una resolución, con los agravios.",
  fields: [F.juzgado, F.expediente, F.cliente, F.cedula,
    { name: "resolucion", label: "Resolución recurrida", type: "text", required: true, hint: "Por ejemplo: resolución de las 10:00 horas del 5 de noviembre de 2026" },
    { name: "agravios", label: "Agravios (motivos del recurso)", type: "list", required: true, hint: "Un motivo por línea." },
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha],
  render: (v) => [
    ...encabezado(v, "Recurso"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, en tiempo y forma interpongo RECURSO DE REVOCATORIA CON APELACIÓN EN SUBSIDIO contra la ${val(v, "resolucion")}, por los siguientes agravios:` },
    { t: "seccion", text: "AGRAVIOS" }, listOr(v, "agravios"),
    { t: "seccion", text: "PETITORIA" }, { t: "p", text: "Solicito que se revoque la resolución recurrida y, en caso de no acogerse la revocatoria, se admita la apelación en subsidio y se eleven los autos al superior." },
    ...cierre(v),
  ],
};

const medioNotificaciones: FormTemplate = {
  key: "senalamiento-medio",
  kind: "escrito",
  category: "Trámite",
  title: "Señalamiento de medio para notificaciones",
  description: "Escrito breve para señalar o cambiar el medio de notificaciones.",
  fields: [F.juzgado, F.expediente, F.cliente, F.cedula, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha],
  render: (v) => [
    ...encabezado(v, "Trámite"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, en el expediente de referencia, respetuosamente señalo como medio para recibir notificaciones: ${val(v, "notificaciones")}.` },
    { t: "p", text: `${val(v, "lugar")}, ${longDate(v.fecha ?? "")}.` },
    { t: "firma", lines: [val(v, "cliente"), "", `Lic./Licda. ${val(v, "abogado")}`, `Carné del Colegio de Abogados ${val(v, "carne")}`] },
  ],
};

const medidaCautelar: FormTemplate = {
  key: "medida-cautelar",
  kind: "escrito",
  category: "Civil",
  title: "Solicitud de medida cautelar",
  description: "Embargo preventivo, anotación de demanda u otra medida, con su justificación.",
  fields: [F.juzgado, F.expediente, F.cliente, F.cedula, F.contraparte,
    { name: "medida", label: "Medida que se solicita", type: "text", required: true, hint: "Por ejemplo: anotación de la demanda sobre la finca matrícula…" },
    { name: "motivos", label: "Motivos (apariencia de buen derecho y peligro en la demora)", type: "list", required: true },
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha],
  render: (v) => [
    ...encabezado(v, "Medida cautelar"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, en el proceso contra ${val(v, "contraparte")}, solicito se decrete la siguiente medida cautelar: ${val(v, "medida")}.` },
    { t: "seccion", text: "MOTIVOS" }, listOr(v, "motivos"),
    ...cierre(v),
  ],
};

const desistimiento: FormTemplate = {
  key: "desistimiento",
  kind: "escrito",
  category: "Trámite",
  title: "Desistimiento",
  description: "Desistimiento del proceso o de una pretensión.",
  fields: [F.juzgado, F.expediente, F.cliente, F.cedula, { name: "alcance", label: "De qué se desiste", type: "textarea", hint: "Del proceso completo o de una pretensión concreta." }, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha],
  render: (v) => [
    ...encabezado(v, "Desistimiento"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, manifiesto que desisto ${val(v, "alcance")}, y solicito que se tenga por desistido y se archive lo correspondiente.` },
    ...cierre(v),
  ],
};

// ---------- Escrituras notariales (con datos de protocolo) ----------

const N = {
  numero: { name: "numero", label: "Número de escritura", type: "text", auto: "notario.numero", required: true, hint: "El siguiente de tu protocolo; se anota allí al generar." } as Field,
  tomo: { name: "tomo", label: "Tomo del protocolo", type: "text", auto: "notario.tomo" } as Field,
  folio: { name: "folio", label: "Folio", type: "text", auto: "notario.folio" } as Field,
  notario: { name: "notario", label: "Notario(a) público(a)", type: "text", auto: "notario.nombre", required: true } as Field,
  oficina: { name: "oficina", label: "Oficina del notario (lugar)", type: "text", auto: "notario.oficina" } as Field,
  hora: { name: "hora", label: "Hora de otorgamiento", type: "text", hint: "Por ejemplo: diez horas" } as Field,
};

const encabezadoNotarial = (v: Values): Block[] => [
  { t: "titulo", text: `ESCRITURA NÚMERO ${val(v, "numero")}` },
  { t: "encabezado", text: `Tomo ${val(v, "tomo")} · Folio ${val(v, "folio")}` },
];
const cierreNotarial = (v: Values): Block[] => [
  { t: "p", text: `Es todo. Expido un primer testimonio. Leído lo escrito al(a los) otorgante(s), lo aprueba(n) y firmamos en ${val(v, "oficina")}, a las ${val(v, "hora")} del ${longDate(v.fecha ?? "")}.` },
  { t: "firma", lines: [val(v, "cliente"), "", `${val(v, "notario")}`, "Notario(a) público(a)"] },
];

const poderGeneralisimo: FormTemplate = {
  key: "poder-generalisimo",
  kind: "escritura",
  category: "Poderes",
  title: "Poder generalísimo sin límite de suma",
  description: "Artículo 1253 del Código Civil.",
  fields: [N.numero, N.tomo, N.folio, N.notario, N.oficina, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio,
    { name: "apoderado", label: "Apoderado(a): nombre y calidades", type: "textarea", required: true }, N.hora, F.fecha],
  render: (v) => [
    ...encabezadoNotarial(v),
    { t: "p", text: `Ante mí, ${val(v, "notario")}, Notario(a) Público(a) con oficina en ${val(v, "oficina")}, comparece ${calidades(v)}, y DICE: Que confiere PODER GENERALÍSIMO SIN LÍMITE DE SUMA, conforme al artículo mil doscientos cincuenta y tres del Código Civil, a favor de ${val(v, "apoderado")}, quien podrá ejercerlo con las facultades que dicha norma establece, pudiendo sustituirlo total o parcialmente, revocar sustituciones y hacer otras de nuevo, sin perder por ello su ejercicio.` },
    ...cierreNotarial(v),
  ],
};

const poderEspecial: FormTemplate = {
  key: "poder-especial",
  kind: "escritura",
  category: "Poderes",
  title: "Poder especial",
  description: "Artículo 1256 del Código Civil, para un acto concreto.",
  fields: [N.numero, N.tomo, N.folio, N.notario, N.oficina, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio,
    { name: "apoderado", label: "Apoderado(a): nombre y calidades", type: "textarea", required: true },
    { name: "acto", label: "Acto o actos para los que se otorga", type: "textarea", required: true }, N.hora, F.fecha],
  render: (v) => [
    ...encabezadoNotarial(v),
    { t: "p", text: `Ante mí, ${val(v, "notario")}, Notario(a) Público(a) con oficina en ${val(v, "oficina")}, comparece ${calidades(v)}, y DICE: Que confiere PODER ESPECIAL, conforme al artículo mil doscientos cincuenta y seis del Código Civil, a favor de ${val(v, "apoderado")}, para que en su nombre y representación realice lo siguiente: ${val(v, "acto")}.` },
    ...cierreNotarial(v),
  ],
};

const compraventaVehiculo: FormTemplate = {
  key: "compraventa-vehiculo",
  kind: "escritura",
  category: "Bienes muebles",
  title: "Compraventa de vehículo",
  description: "Traspaso de vehículo inscrito en el Registro Nacional.",
  fields: [N.numero, N.tomo, N.folio, N.notario, N.oficina, { ...F.cliente, label: "Vendedor(a): nombre" }, F.cedula, F.estadoCivil, F.profesion, F.domicilio,
    { name: "comprador", label: "Comprador(a): nombre y calidades", type: "textarea", required: true },
    { name: "placa", label: "Placa", type: "text", required: true },
    { name: "vehiculo", label: "Descripción del vehículo", type: "textarea", hint: "Marca, estilo, año, color, VIN, número de motor…" },
    { name: "precio", label: "Precio", type: "text", required: true }, N.hora, F.fecha],
  render: (v) => [
    ...encabezadoNotarial(v),
    { t: "p", text: `Ante mí, ${val(v, "notario")}, Notario(a) Público(a) con oficina en ${val(v, "oficina")}, comparecen ${calidades(v)}, en adelante «la parte vendedora»; y ${val(v, "comprador")}, en adelante «la parte compradora», y DICEN:` },
    { t: "ordinales", items: [
      `Que la parte vendedora es dueña del vehículo placa ${val(v, "placa")}, ${val(v, "vehiculo")}, inscrito en el Registro Nacional, libre de gravámenes y anotaciones salvo los que constan en el Registro.`,
      `Que vende dicho vehículo a la parte compradora por el precio de ${val(v, "precio")}, que la parte vendedora declara recibido a su entera satisfacción.`,
      "Que la parte compradora acepta la venta en los términos indicados.",
    ] },
    ...cierreNotarial(v),
  ],
};

const declaracionJurada: FormTemplate = {
  key: "declaracion-jurada",
  kind: "escritura",
  category: "Declaraciones",
  title: "Declaración jurada",
  description: "Declaración bajo fe de juramento, con la advertencia de ley.",
  fields: [N.numero, N.tomo, N.folio, N.notario, N.oficina, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio,
    { name: "declaracion", label: "Lo que se declara", type: "list", required: true, hint: "Una declaración por línea." }, N.hora, F.fecha],
  render: (v) => [
    ...encabezadoNotarial(v),
    { t: "p", text: `Ante mí, ${val(v, "notario")}, Notario(a) Público(a) con oficina en ${val(v, "oficina")}, comparece ${calidades(v)}, a quien advierto sobre las penas con que la ley castiga el delito de falso testimonio y perjurio, y bajo fe de juramento DECLARA:` },
    listOr(v, "declaracion"),
    ...cierreNotarial(v),
  ],
};

export const TEMPLATES: FormTemplate[] = [demandaOrdinaria, demandaLaboral, contestacion, recurso, medidaCautelar, desistimiento, medioNotificaciones, poderGeneralisimo, poderEspecial, compraventaVehiculo, declaracionJurada];

export function getTemplate(key: string): FormTemplate | null {
  return TEMPLATES.find((t) => t.key === key) ?? null;
}
