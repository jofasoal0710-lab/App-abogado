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
  derecho: {
    name: "derecho",
    label: "Fundamento de derecho",
    type: "textarea",
    auto: "expediente.fundamentos",
    hint: "Se llena con la normativa citada en el expediente (pestaña «Normativa»). Puedes editarlo.",
  } as Field,
};

/** Sección «FUNDAMENTO DE DERECHO» solo si se ha escrito algo. */
const derechoSeccion = (v: Values): Block[] =>
  v.derecho?.trim() ? [{ t: "seccion", text: "FUNDAMENTO DE DERECHO" }, { t: "p", text: v.derecho.trim() }] : [];

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
    F.derecho,
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
    F.derecho,
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
    ...derechoSeccion(v),
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
    F.derecho,
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha],
  render: (v) => [
    ...encabezado(v, "Ordinario"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, en mi condición de parte demandada en el proceso que en mi contra sigue ${val(v, "contraparte")}, contesto la demanda en los siguientes términos:` },
    { t: "seccion", text: "SOBRE LOS HECHOS" }, listOr(v, "hechos"),
    { t: "seccion", text: "EXCEPCIONES" }, listOr(v, "excepciones"),
    { t: "seccion", text: "PRUEBA" }, listOr(v, "prueba"),
    ...derechoSeccion(v),
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
    F.derecho,
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha],
  render: (v) => [
    ...encabezado(v, "Recurso"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, en tiempo y forma interpongo RECURSO DE REVOCATORIA CON APELACIÓN EN SUBSIDIO contra la ${val(v, "resolucion")}, por los siguientes agravios:` },
    { t: "seccion", text: "AGRAVIOS" }, listOr(v, "agravios"),
    ...derechoSeccion(v),
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
    F.derecho,
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha],
  render: (v) => [
    ...encabezado(v, "Medida cautelar"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, en el proceso contra ${val(v, "contraparte")}, solicito se decrete la siguiente medida cautelar: ${val(v, "medida")}.` },
    { t: "seccion", text: "MOTIVOS" }, listOr(v, "motivos"),
    ...derechoSeccion(v),
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


// ---------- Escritos penales (Código Procesal Penal, Ley 7594) ----------

const P = {
  despacho: { name: "juzgado", label: "Despacho", type: "text", auto: "expediente.juzgado", required: true, hint: "Por ejemplo: Tribunal Penal del Primer Circuito Judicial de San José" } as Field,
  expediente: { name: "expediente", label: "Número de expediente penal", type: "text", auto: "expediente.numero", hint: "Formato 26-000123-0042-PE" } as Field,
  imputado: { name: "contraparte", label: "Persona imputada o querellada", type: "text", auto: "expediente.contraparte" } as Field,
  ofendido: { name: "ofendido", label: "Persona ofendida", type: "text" } as Field,
  delito: { name: "delito", label: "Delito", type: "text", required: true, hint: "Por ejemplo: estafa, difamación, lesiones culposas" } as Field,
  hechos: { name: "hechos", label: "Hechos", type: "list", required: true, hint: "Un hecho por línea, en orden: qué pasó, cuándo y dónde." } as Field,
  pruebas: { name: "pruebas", label: "Prueba que se ofrece", type: "list", hint: "Documental, testimonial (nombre y domicilio del testigo), pericial…" } as Field,
};

const encabezadoPenal = (v: Values, destinatario: string, asunto: string): Block[] => [
  { t: "encabezado", text: destinatario },
  ...(v.expediente?.trim() ? [{ t: "encabezado", text: `Expediente: ${v.expediente.trim()}` } as Block] : []),
  ...(v.contraparte?.trim() ? [{ t: "encabezado", text: `Imputado(a): ${v.contraparte.trim()}` } as Block] : []),
  ...(v.delito?.trim() ? [{ t: "encabezado", text: `Delito: ${v.delito.trim()}` } as Block] : []),
  { t: "encabezado", text: asunto },
];
const pruebasSeccion = (v: Values): Block[] => (lines(v, "pruebas").length ? [{ t: "seccion", text: "PRUEBA" }, listOr(v, "pruebas")] : []);

const denunciaPenal: FormTemplate = {
  key: "denuncia-penal",
  kind: "escrito",
  category: "Penal",
  title: "Denuncia penal",
  description: "Ante el Ministerio Público: hechos, prueba y solicitud de investigación.",
  fields: [
    { name: "juzgado", label: "Fiscalía", type: "text", auto: "expediente.juzgado", required: true, hint: "Por ejemplo: Fiscalía Adjunta de Fraudes, Primer Circuito Judicial de San José" },
    F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio, P.imputado, P.delito, P.hechos, P.pruebas, F.derecho, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezadoPenal(v, `SEÑOR(A) FISCAL DE LA ${val(v, "juzgado").toUpperCase()}`, "Asunto: DENUNCIA PENAL"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, interpongo formal DENUNCIA PENAL contra ${v.contraparte?.trim() || "quien resulte responsable"} por el delito de ${val(v, "delito")}, con fundamento en los siguientes hechos:` },
    { t: "seccion", text: "HECHOS" }, listOr(v, "hechos"),
    ...pruebasSeccion(v),
    ...derechoSeccion(v),
    { t: "seccion", text: "PETITORIA" },
    { t: "p", text: "Solicito que se tenga por interpuesta la presente denuncia, se ordene la investigación de los hechos y, en su oportunidad, se ejerza la acción penal. Solicito además que se me tenga como víctima, con los derechos que me confiere el artículo 71 del Código Procesal Penal, y que se me informe de las resoluciones que pongan fin al procedimiento." },
    ...cierre(v),
  ],
};

const querella: FormTemplate = {
  key: "querella-accion-privada",
  kind: "escrito",
  category: "Penal",
  title: "Querella por delito de acción privada",
  description: "Delitos contra el honor y otros de acción privada, con acción civil resarcitoria (arts. 19 y 72 CPP).",
  fields: [
    P.despacho, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio,
    { name: "contraparte", label: "Persona querellada (nombre, calidades y domicilio)", type: "text", auto: "expediente.contraparte", required: true },
    P.delito, P.hechos, P.pruebas,
    { name: "civil", label: "Acción civil resarcitoria (opcional)", type: "textarea", hint: "Daños y perjuicios que se reclaman y su estimación" },
    F.derecho, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezadoPenal(v, `SEÑOR(A) JUEZ(A) DEL ${val(v, "juzgado").toUpperCase()}`, "Asunto: QUERELLA POR DELITO DE ACCIÓN PRIVADA"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, con fundamento en los artículos 19 y 72 del Código Procesal Penal, interpongo QUERELLA contra ${val(v, "contraparte")} por el delito de ${val(v, "delito")}${v.civil?.trim() ? ", y ejerzo conjuntamente la acción civil resarcitoria" : ""}, con base en los siguientes hechos:` },
    { t: "seccion", text: "HECHOS" }, listOr(v, "hechos"),
    ...pruebasSeccion(v),
    ...(v.civil?.trim() ? [{ t: "seccion", text: "ACCIÓN CIVIL RESARCITORIA" } as Block, { t: "p", text: v.civil.trim() } as Block] : []),
    ...derechoSeccion(v),
    { t: "seccion", text: "PETITORIA" },
    { t: "p", text: `Solicito que se admita la querella, se convoque a la audiencia de conciliación y, de no lograrse, se siga el proceso hasta dictar sentencia condenatoria contra ${val(v, "contraparte")}${v.civil?.trim() ? ", con condena al pago de los daños y perjuicios reclamados" : ""} y al pago de ambas costas.` },
    ...cierre(v),
  ],
};

const apelacionSentenciaPenal: FormTemplate = {
  key: "apelacion-sentencia-penal",
  kind: "escrito",
  category: "Penal",
  title: "Recurso de apelación de sentencia penal",
  description: "Ante el tribunal que dictó la sentencia, dentro de 15 días hábiles (art. 460 CPP).",
  fields: [
    P.despacho, P.expediente, F.cliente, F.cedula, P.imputado, P.delito,
    { name: "sentencia", label: "Sentencia recurrida", type: "text", required: true, hint: "Por ejemplo: sentencia N.° 123-2026 de las 14:00 horas del 3 de noviembre de 2026" },
    { name: "agravios", label: "Motivos y agravios", type: "list", required: true, hint: "Un motivo por línea: qué se reclama, por qué es un error y qué perjuicio causa." },
    { name: "pretension", label: "Pretensión", type: "textarea", required: true, hint: "Por ejemplo: que se anule la sentencia y se ordene el juicio de reenvío, o que se absuelva" },
    P.pruebas, F.derecho, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezadoPenal(v, `SEÑOR(A) JUEZ(A) DEL ${val(v, "juzgado").toUpperCase()}`, "Asunto: RECURSO DE APELACIÓN DE SENTENCIA"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, en tiempo y forma, con fundamento en el artículo 460 del Código Procesal Penal, interpongo RECURSO DE APELACIÓN DE SENTENCIA contra la ${val(v, "sentencia")}, para ante el Tribunal de Apelación de Sentencia Penal, por los siguientes motivos:` },
    { t: "seccion", text: "MOTIVOS Y AGRAVIOS" }, listOr(v, "agravios"),
    ...pruebasSeccion(v),
    ...derechoSeccion(v),
    { t: "seccion", text: "PRETENSIÓN" }, { t: "p", text: val(v, "pretension") },
    { t: "p", text: "Solicito audiencia oral para exponer los alegatos y recibir la prueba ofrecida (art. 463 del Código Procesal Penal)." },
    ...cierre(v),
  ],
};

const medidaAlterna: FormTemplate = {
  key: "solicitud-medida-alterna",
  kind: "escrito",
  category: "Penal",
  title: "Solicitud de medida alterna",
  description: "Conciliación, suspensión del proceso a prueba o reparación integral del daño (arts. 25, 30 j y 36 CPP).",
  fields: [
    P.despacho, P.expediente, F.cliente, F.cedula, P.ofendido, P.delito,
    { name: "medida", label: "Medida que se solicita", type: "text", required: true, hint: "conciliación · suspensión del proceso a prueba · reparación integral del daño" },
    { name: "plan", label: "Plan de reparación o acuerdo propuesto", type: "list", required: true, hint: "Un compromiso por línea (montos, plazos, disculpa, servicio comunitario…)" },
    { name: "condiciones", label: "Condiciones que se ofrece cumplir (suspensión a prueba)", type: "list", hint: "Reglas del art. 26: residir en un lugar, no portar armas, programas de tratamiento…" },
    F.derecho, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezadoPenal(v, `SEÑOR(A) JUEZ(A) DEL ${val(v, "juzgado").toUpperCase()}`, `Asunto: SOLICITUD DE ${val(v, "medida").toUpperCase()}`),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, en mi condición de persona imputada, antes de acordarse la apertura a juicio solicito la aplicación de la ${val(v, "medida")}${v.ofendido?.trim() ? `, con la conformidad de la persona ofendida ${v.ofendido.trim()}` : ""}. Manifiesto que durante los cinco años anteriores no me he beneficiado de la conciliación, la suspensión del proceso a prueba ni la reparación integral del daño.` },
    { t: "seccion", text: "PLAN DE REPARACIÓN O ACUERDO" }, listOr(v, "plan"),
    ...(lines(v, "condiciones").length ? [{ t: "seccion", text: "CONDICIONES QUE ME COMPROMETO A CUMPLIR" } as Block, listOr(v, "condiciones")] : []),
    ...derechoSeccion(v),
    { t: "seccion", text: "PETITORIA" },
    { t: "p", text: "Solicito que se convoque a audiencia oral para conocer esta solicitud, se escuche a la persona ofendida y al Ministerio Público, se apruebe el plan propuesto y, una vez cumplido, se declare extinguida la acción penal." },
    ...cierre(v),
  ],
};

const cesePrision: FormTemplate = {
  key: "cese-prision-preventiva",
  kind: "escrito",
  category: "Penal",
  title: "Solicitud de cese o sustitución de la prisión preventiva",
  description: "Por cambio de circunstancias, por su duración o por exceder el plazo (arts. 239 y 257 CPP).",
  fields: [
    P.despacho, P.expediente, F.cliente, F.cedula, P.delito,
    { name: "desde", label: "Prisión preventiva desde", type: "date", required: true },
    { name: "motivos", label: "Motivos", type: "list", required: true, hint: "Nuevos elementos, arraigo (domicilio, trabajo, familia), duración frente a la posible pena…" },
    { name: "sustitutiva", label: "Medida sustitutiva que se ofrece", type: "text", hint: "Por ejemplo: presentarse a firmar cada quince días, impedimento de salida, fianza" },
    F.derecho, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezadoPenal(v, `SEÑOR(A) JUEZ(A) DEL ${val(v, "juzgado").toUpperCase()}`, "Asunto: SOLICITUD DE CESE DE LA PRISIÓN PREVENTIVA"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, en prisión preventiva desde el ${longDate(v.desde ?? "")}, solicito el cese de esa medida${v.sustitutiva?.trim() ? ` y su sustitución por ${v.sustitutiva.trim()}` : ""}, con fundamento en el artículo 257 del Código Procesal Penal y por los siguientes motivos:` },
    { t: "seccion", text: "MOTIVOS" }, listOr(v, "motivos"),
    ...derechoSeccion(v),
    { t: "seccion", text: "PETITORIA" },
    { t: "p", text: `Solicito que se convoque a audiencia oral, se ordene el cese de la prisión preventiva${v.sustitutiva?.trim() ? " y se impongan las medidas sustitutivas ofrecidas" : ""} y se disponga mi libertad inmediata.` },
    ...cierre(v),
  ],
};

// ---------- Escritos de familia (Código de Familia y Código Procesal de Familia, Ley 9747) ----------

const FAM = {
  juzgado: { name: "juzgado", label: "Juzgado", type: "text", auto: "expediente.juzgado", required: true, hint: "Por ejemplo: Juzgado de Familia del Primer Circuito Judicial de San José" } as Field,
  expediente: { name: "expediente", label: "Número de expediente", type: "text", auto: "expediente.numero" } as Field,
  demandado: { name: "contraparte", label: "Persona demandada (nombre, calidades y domicilio)", type: "text", auto: "expediente.contraparte", required: true } as Field,
  hijos: { name: "hijos", label: "Hijos e hijas menores de edad o con discapacidad", type: "list", hint: "Nombre, fecha de nacimiento y cédula, uno por línea. Vacío si no hay." } as Field,
  hechos: { name: "hechos", label: "Hechos", type: "list", required: true, hint: "Un hecho por línea, en orden." } as Field,
  pruebas: { name: "pruebas", label: "Prueba que se ofrece", type: "list", hint: "Certificaciones del Registro Civil, testigos (nombre y domicilio), documentos…" } as Field,
};
const hijosSeccion = (v: Values): Block[] => (lines(v, "hijos").length ? [{ t: "seccion", text: "HIJOS E HIJAS" }, listOr(v, "hijos")] : []);
const pruebaFam = (v: Values): Block[] => (lines(v, "pruebas").length ? [{ t: "seccion", text: "PRUEBA" }, listOr(v, "pruebas")] : []);

const demandaPension: FormTemplate = {
  key: "demanda-pension-alimentaria",
  kind: "escrito",
  category: "Familia",
  title: "Demanda de pensión alimentaria",
  description: "Monto pretendido por cada beneficiario, retención salarial y prueba de ingresos (arts. 164 CF y 267 CPF).",
  fields: [
    FAM.juzgado, FAM.expediente, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio, FAM.demandado,
    { name: "beneficiarios", label: "Personas beneficiarias y monto mensual pretendido para cada una", type: "list", required: true, hint: "Por ejemplo: María Pérez Mora, 8 años — ₡150 000 mensuales" },
    { name: "ingresos", label: "Ingresos y patrono de la persona demandada", type: "textarea", hint: "Dónde trabaja, cuánto gana, bienes conocidos" },
    { name: "retencion", label: "¿Se pide retención salarial?", type: "text", hint: "Sí, al patrono …; o dejar vacío" },
    FAM.hechos, FAM.pruebas, F.derecho, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezado(v, "Pensión alimentaria"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, en representación de las personas beneficiarias que indico, interpongo DEMANDA DE PENSIÓN ALIMENTARIA contra ${val(v, "contraparte")}, con fundamento en los artículos 164 y 169 del Código de Familia y 267 del Código Procesal de Familia, por los siguientes hechos:` },
    { t: "seccion", text: "HECHOS" }, listOr(v, "hechos"),
    { t: "seccion", text: "PERSONAS BENEFICIARIAS Y MONTO PRETENDIDO" }, listOr(v, "beneficiarios"),
    ...(v.ingresos?.trim() ? [{ t: "seccion", text: "INGRESOS DE LA PERSONA DEMANDADA" } as Block, { t: "p", text: v.ingresos.trim() } as Block] : []),
    ...pruebaFam(v),
    ...derechoSeccion(v),
    { t: "seccion", text: "PETITORIA" },
    { t: "p", text: `Solicito que se fije la cuota alimentaria pretendida para cada persona beneficiaria, con el aguinaldo y, si procede, el salario escolar (art. 164 del Código de Familia) y su aumento automático (art. 279 del Código Procesal de Familia)${v.retencion?.trim() ? `; que se ordene la retención salarial (${v.retencion.trim()})` : ""}; y que se convoque a la audiencia previa de conciliación (art. 269 del Código Procesal de Familia).` },
    ...cierre(v),
  ],
};

const apremio: FormTemplate = {
  key: "solicitud-apremio-corporal",
  kind: "escrito",
  category: "Familia",
  title: "Solicitud de apremio corporal",
  description: "Por cuotas alimentarias no pagadas, hasta seis mensualidades (art. 283 CPF).",
  fields: [
    FAM.juzgado, FAM.expediente, F.cliente, F.cedula,
    { name: "contraparte", label: "Persona deudora", type: "text", auto: "expediente.contraparte", required: true },
    { name: "adeudado", label: "Cuotas y rubros adeudados", type: "list", required: true, hint: "Mes y monto, uno por línea (incluye aguinaldo o salario escolar si se deben)" },
    { name: "total", label: "Total adeudado (₡)", type: "text", required: true },
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezado(v, "Pensión alimentaria — apremio corporal"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, parte actora en el proceso alimentario de referencia, manifiesto que ${val(v, "contraparte")} no ha cumplido con el pago de las siguientes cuotas y rubros:` },
    listOr(v, "adeudado"),
    { t: "p", text: `Lo adeudado asciende a ${val(v, "total")}. Con fundamento en el artículo 283 del Código Procesal de Familia, solicito que se gire orden de apremio corporal contra la persona deudora por las sumas adeudadas, hasta por seis mensualidades incluida la presente, además del aguinaldo, el salario escolar y los gastos extraordinarios que correspondan.` },
    ...cierre(v),
  ],
};

const demandaDivorcio: FormTemplate = {
  key: "demanda-divorcio",
  kind: "escrito",
  category: "Familia",
  title: "Demanda de divorcio (proceso resolutivo familiar)",
  description: "Por causal del art. 48 del Código de Familia, con custodia, alimentos, interrelación y gananciales.",
  fields: [
    FAM.juzgado, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio, FAM.demandado,
    { name: "matrimonio", label: "Fecha y lugar del matrimonio", type: "text", required: true },
    { name: "causal", label: "Causal (art. 48 del Código de Familia)", type: "text", required: true, hint: "Por ejemplo: separación de hecho por más de tres años (inciso 7)" },
    FAM.hechos, FAM.hijos,
    { name: "pretensiones", label: "Pretensiones", type: "list", required: true, hint: "Divorcio; custodia y responsabilidad parental; alimentos; régimen de interrelación familiar; liquidación de gananciales…" },
    FAM.pruebas, F.derecho, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezado(v, "Proceso resolutivo familiar — divorcio"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, interpongo DEMANDA DE DIVORCIO contra ${val(v, "contraparte")}, con quien contraje matrimonio el ${val(v, "matrimonio")}, por la causal de ${val(v, "causal")}, prevista en el artículo 48 del Código de Familia, con base en los siguientes hechos:` },
    { t: "seccion", text: "HECHOS" }, listOr(v, "hechos"),
    ...hijosSeccion(v),
    ...pruebaFam(v),
    ...derechoSeccion(v),
    { t: "seccion", text: "PRETENSIONES" }, listOr(v, "pretensiones"),
    ...cierre(v),
  ],
};

const convenioDivorcio: FormTemplate = {
  key: "aprobacion-convenio-divorcio",
  kind: "escrito",
  category: "Familia",
  title: "Solicitud de aprobación del convenio de divorcio por mutuo consentimiento",
  description: "Con hijos menores o bienes: se presenta al juzgado dentro de los tres meses de la escritura (art. 48 CF).",
  fields: [
    FAM.juzgado, F.cliente, F.cedula,
    { name: "contraparte", label: "Otro cónyuge (nombre y cédula)", type: "text", auto: "expediente.contraparte", required: true },
    { name: "escritura", label: "Escritura del convenio", type: "text", required: true, hint: "Número, notario(a) y fecha: escritura N.° 45 otorgada ante la notaria … el 10 de noviembre de 2026" },
    FAM.hijos,
    { name: "bienes", label: "Bienes a los que se refiere el convenio", type: "list" },
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezado(v, "Divorcio por mutuo consentimiento"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, presento para su aprobación el convenio de divorcio por mutuo consentimiento suscrito con ${val(v, "contraparte")}, contenido en la ${val(v, "escritura")}, dentro del plazo de tres meses que señala el artículo 48 del Código de Familia.` },
    ...hijosSeccion(v),
    ...(lines(v, "bienes").length ? [{ t: "seccion", text: "BIENES" } as Block, listOr(v, "bienes")] : []),
    { t: "seccion", text: "PETITORIA" },
    { t: "p", text: "Solicito que se apruebe el convenio, se decrete el divorcio por mutuo consentimiento y se ordene su inscripción en el Registro Civil y en los demás registros que correspondan." },
    ...cierre(v),
  ],
};

const unionHecho: FormTemplate = {
  key: "reconocimiento-union-hecho",
  kind: "escrito",
  category: "Familia",
  title: "Demanda de reconocimiento de unión de hecho",
  description: "Unión pública, notoria, única y estable por más de dos años; caduca a los dos años de la ruptura (arts. 245 y 246 CF).",
  fields: [
    FAM.juzgado, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio,
    { name: "contraparte", label: "Conviviente o su sucesión (nombre y calidades)", type: "text", auto: "expediente.contraparte", required: true },
    { name: "inicio", label: "Inicio de la convivencia", type: "date", required: true },
    { name: "fin", label: "Ruptura de la convivencia o fallecimiento", type: "date", required: true },
    FAM.hechos, FAM.hijos,
    { name: "bienes", label: "Bienes adquiridos durante la unión", type: "list" },
    FAM.pruebas, F.derecho, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezado(v, "Proceso resolutivo familiar — reconocimiento de unión de hecho"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, interpongo DEMANDA DE RECONOCIMIENTO DE UNIÓN DE HECHO contra ${val(v, "contraparte")}, con quien mantuve una convivencia pública, notoria, única y estable desde el ${longDate(v.inicio ?? "")} hasta el ${longDate(v.fin ?? "")}, con fundamento en los artículos 245 y 246 del Código de Familia y por los siguientes hechos:` },
    { t: "seccion", text: "HECHOS" }, listOr(v, "hechos"),
    ...hijosSeccion(v),
    ...(lines(v, "bienes").length ? [{ t: "seccion", text: "BIENES ADQUIRIDOS DURANTE LA UNIÓN" } as Block, listOr(v, "bienes")] : []),
    ...pruebaFam(v),
    ...derechoSeccion(v),
    { t: "seccion", text: "PETITORIA" },
    { t: "p", text: "Solicito que se declare la existencia de la unión de hecho entre las fechas indicadas, con todos sus efectos patrimoniales, incluida la liquidación de los bienes gananciales, y que se ordene la inscripción correspondiente." },
    ...cierre(v),
  ],
};

// ---------- Cobro (Código Procesal Civil) y constitucional (Ley de la Jurisdicción Constitucional, 7135) ----------

const demandaMonitoria: FormTemplate = {
  key: "demanda-monitoria",
  kind: "escrito",
  category: "Civil",
  title: "Demanda monitoria dineraria (cobro)",
  description: "Cobro de una obligación dineraria líquida y exigible con documento, con o sin fuerza ejecutiva (art. 110.1 CPC).",
  fields: [
    F.juzgado, F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio,
    { name: "contraparte", label: "Persona deudora (nombre, calidades y domicilio)", type: "text", auto: "expediente.contraparte", required: true },
    { name: "documento", label: "Documento en que consta la deuda", type: "text", required: true, hint: "Pagaré, letra de cambio, contrato, factura aceptada…" },
    { name: "capital", label: "Capital adeudado", type: "text", required: true, hint: "₡1 500 000" },
    { name: "exigible", label: "Exigible desde", type: "date", required: true },
    { name: "intereses", label: "Intereses que se reclaman", type: "text", hint: "Corrientes y moratorios, tasa y desde cuándo" },
    { name: "hechos", label: "Hechos", type: "list", required: true },
    { name: "embargo", label: "Embargo que se solicita (opcional)", type: "text", hint: "Bienes o salario de la persona deudora" },
    F.derecho, F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezado(v, "Proceso monitorio dinerario"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, interpongo PROCESO MONITORIO DINERARIO contra ${val(v, "contraparte")}, para el cobro de la obligación dineraria líquida y exigible que consta en ${val(v, "documento")}, con fundamento en el artículo 110 del Código Procesal Civil y en los siguientes hechos:` },
    { t: "seccion", text: "HECHOS" }, listOr(v, "hechos"),
    { t: "seccion", text: "PRETENSIÓN" },
    { t: "p", text: `Solicito que se dicte la resolución intimatoria y se ordene a la parte demandada pagar el capital de ${val(v, "capital")}, exigible desde el ${longDate(v.exigible ?? "")}${v.intereses?.trim() ? `, más ${v.intereses.trim()}` : ", más los intereses que correspondan"}, y ambas costas.` },
    ...(v.embargo?.trim() ? [{ t: "seccion", text: "EMBARGO" } as Block, { t: "p", text: `Solicito el embargo de ${v.embargo.trim()} en cantidad suficiente para cubrir el capital, los intereses y las costas.` } as Block] : []),
    { t: "seccion", text: "PRUEBA" }, { t: "p", text: `Documental: ${val(v, "documento")}, que aporto con la demanda.` },
    ...derechoSeccion(v),
    ...cierre(v),
  ],
};

const encabezadoSala = (asunto: string): Block[] => [
  { t: "encabezado", text: "SEÑORES MAGISTRADOS DE LA SALA CONSTITUCIONAL DE LA CORTE SUPREMA DE JUSTICIA" },
  { t: "encabezado", text: asunto },
];

const amparo: FormTemplate = {
  key: "recurso-amparo",
  kind: "escrito",
  category: "Constitucional",
  title: "Recurso de amparo",
  description: "Ante la Sala Constitucional: hecho u omisión, derecho violado, autoridad y prueba (arts. 29, 35 y 38 LJC).",
  fields: [
    F.cliente, F.cedula, F.estadoCivil, F.profesion, F.domicilio,
    { name: "recurrido", label: "Autoridad, órgano o persona recurrida", type: "text", required: true, hint: "Por ejemplo: Caja Costarricense de Seguro Social, Hospital México" },
    { name: "hechos", label: "Hechos u omisiones", type: "list", required: true, hint: "Qué pasó, cuándo y quién lo hizo, uno por línea" },
    { name: "derechos", label: "Derechos fundamentales violados o amenazados", type: "text", required: true, hint: "Por ejemplo: derecho a la salud y a la vida (arts. 21 y 50 de la Constitución)" },
    { name: "pruebas", label: "Prueba", type: "list" },
    { name: "pretension", label: "Lo que se pide", type: "textarea", required: true, hint: "Por ejemplo: que se ordene programar la cirugía en un plazo razonable" },
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezadoSala("Asunto: RECURSO DE AMPARO"),
    { t: "p", text: `Quien suscribe, ${calidades(v)}, con fundamento en los artículos 48 de la Constitución Política y 29 y siguientes de la Ley de la Jurisdicción Constitucional, interpongo RECURSO DE AMPARO contra ${val(v, "recurrido")}, por la violación de ${val(v, "derechos")}, con base en los siguientes hechos:` },
    { t: "seccion", text: "HECHOS" }, listOr(v, "hechos"),
    ...(lines(v, "pruebas").length ? [{ t: "seccion", text: "PRUEBA" } as Block, listOr(v, "pruebas")] : []),
    { t: "seccion", text: "PRETENSIÓN" }, { t: "p", text: val(v, "pretension") },
    { t: "p", text: "Solicito que se declare con lugar el recurso, con condenatoria al pago de las costas, daños y perjuicios causados, que se liquidarán en ejecución de sentencia." },
    ...cierre(v),
  ],
};

const habeas: FormTemplate = {
  key: "recurso-habeas-corpus",
  kind: "escrito",
  category: "Constitucional",
  title: "Recurso de hábeas corpus",
  description: "Para proteger la libertad e integridad personales y la libertad de tránsito (arts. 15 a 19 LJC). Lo puede presentar cualquier persona.",
  fields: [
    F.cliente, F.cedula,
    { name: "amparado", label: "Persona a favor de quien se interpone", type: "text", required: true, hint: "Nombre y cédula; puede ser la misma persona que lo presenta" },
    { name: "recurrido", label: "Autoridad recurrida", type: "text", required: true, hint: "Si no se conoce, se tiene por interpuesto contra el jerarca (art. 19)" },
    { name: "hechos", label: "Hechos (detención, amenaza o restricción)", type: "list", required: true },
    { name: "lugar_detencion", label: "Lugar donde se encuentra la persona (si está detenida)", type: "text" },
    F.notificaciones, F.abogado, F.carne, F.lugar, F.fecha,
  ],
  render: (v) => [
    ...encabezadoSala("Asunto: RECURSO DE HÁBEAS CORPUS"),
    { t: "p", text: `Quien suscribe, ${val(v, "cliente")}, portador(a) de la cédula de identidad número ${val(v, "cedula")}, con fundamento en el artículo 48 de la Constitución Política y en los artículos 15 y siguientes de la Ley de la Jurisdicción Constitucional, interpongo RECURSO DE HÁBEAS CORPUS a favor de ${val(v, "amparado")} y contra ${val(v, "recurrido")}, por los siguientes hechos:` },
    { t: "seccion", text: "HECHOS" }, listOr(v, "hechos"),
    ...(v.lugar_detencion?.trim() ? [{ t: "p", text: `La persona amparada se encuentra en: ${v.lugar_detencion.trim()}.` } as Block] : []),
    { t: "seccion", text: "PRETENSIÓN" },
    { t: "p", text: "Solicito que se pida informe a la autoridad recurrida, se ordene no ejecutar acto alguno que haga ineficaz lo que se resuelva, y se declare con lugar el recurso, restituyendo a la persona amparada en el pleno goce de su libertad e integridad personales, con condenatoria en costas, daños y perjuicios." },
    ...cierre(v),
  ],
};

export const TEMPLATES: FormTemplate[] = [demandaOrdinaria, demandaLaboral, contestacion, recurso, medidaCautelar, desistimiento, medioNotificaciones, denunciaPenal, querella, apelacionSentenciaPenal, medidaAlterna, cesePrision, demandaPension, apremio, demandaDivorcio, convenioDivorcio, unionHecho, demandaMonitoria, amparo, habeas, poderGeneralisimo, poderEspecial, compraventaVehiculo, declaracionJurada];

export function getTemplate(key: string): FormTemplate | null {
  return TEMPLATES.find((t) => t.key === key) ?? null;
}
