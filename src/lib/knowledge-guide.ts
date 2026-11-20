/**
 * Guía inicial de la base de conocimiento (Costa Rica). Redactada a partir del texto vigente del
 * Código de Trabajo (versión 64) y del Código Procesal Civil (Ley 9342, versión 5), consultados en el
 * SCIJ, y del Arancel de honorarios de abogacía y notariado (Decreto 41457-JP reformado por el 41930-JP,
 * SINALEVI versión 4 de 4). Se carga marcada como «sin revisar»: el despacho debe revisarla y completarla.
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
  {
    title: "Honorarios mínimos: el arancel oficial de abogacía y notariado",
    area: "despacho",
    keywords: "arancel honorarios mínimos tarifa cobrar cobro cuánto cobro colegio de abogados decreto 41457 obligatorio contrato de servicios cuota litis",
    refs: "",
    body: `Rige el Arancel de honorarios por servicios profesionales de abogacía y notariado: Decreto Ejecutivo 41457-JP (2018), reformado por el 41930-JP (2019). La reforma del Decreto 43704-JP (2022), que eliminaba los mínimos, fue anulada por el Tribunal Contencioso Administrativo (resolución 00958 del 16/02/2024), así que los mínimos siguen vigentes.
- Es de acatamiento obligatorio (art. 1): los honorarios no pueden ser inferiores a los mínimos (art. 5).
- Se pueden pactar montos mayores con convenio escrito que indique el objeto del servicio, el monto y la forma de pago (art. 5).
- Hay que informar al cliente el monto de los honorarios desde el inicio (art. 3).
- El contrato de cuota litis (una parte de lo que se obtenga) es independiente de las costas personales (art. 6).
- Los montos se actualizan cada dos años según el IPC, como máximo un 10 % (art. 112): el Colegio publica la actualización.
En la app: Facturación → Tarifario muestra el arancel completo y permite registrar la actualización vigente.`,
  },
  {
    title: "Cobrar por horas: hora profesional mínima",
    area: "despacho",
    keywords: "hora profesional tarifa por hora cobrar por horas mínimo por hora noventa mil honorarios por hora notario",
    refs: "",
    body: `Se puede pactar con el cliente el pago por horas profesionales, siempre que el total no sea inferior al mínimo que el arancel fija para ese asunto (art. 7).
- La hora profesional mínima es de ₡90.750 (art. 7), según el texto del decreto (más la actualización del Colegio, si la hay).
- En notariado, el pago por horas procede solo para actos o asesorías no previstos en el arancel, o por trámites y desplazamientos extraordinarios; mínimo ₡90.750 por hora (art. 63).
En la app: cada expediente por horas puede tener su propia tarifa (Editar → Cobro de honorarios); si no, se usa la de cada abogado. El botón «Guía» junto a la tarifa muestra el tarifario y el mínimo.`,
  },
  {
    title: "Cobrar por proceso: tarifa general y pago por etapas",
    area: "despacho",
    keywords: "cobrar por proceso monto total tarifa general procesos civiles cuantía porcentaje etapas tercios demanda sentencia conciliación monitorio ejecución desahucio sucesorio casación",
    refs: "",
    body: `Procesos con cuantía (civil, comercial, agrario, contencioso, tributario), art. 16: 20 % hasta ₡16.500.000; 15 % sobre el exceso hasta ₡82.500.000; 10 % sobre el exceso. Cuantía inestimable: mínimo ₡242.000 (art. 19).
Pago por etapas, salvo convenio escrito (art. 18): un tercio al presentar la demanda o contestación, un tercio al concluir la fase demostrativa y un tercio con la sentencia.
- Conciliación, mediación o transacción: 50 % de la tarifa (art. 17).
- Incluye recursos ordinarios e incidentes hasta segunda instancia; la casación se cobra aparte, mínimo ₡605.000 (art. 20).
- Monitorio: 50 % de la tarifa, mínimo ₡60.500; 50 % con la demanda, 25 % con la sentencia firme y 25 % con el remate (art. 21).
- Ejecución: 50 % de la tarifa, mínimo ₡60.500; mitad con la demanda y mitad con el remate (art. 22).
- Desahucio: tarifa general sobre la cuantía, mínimo ₡181.500; mitad con la demanda y mitad con la sentencia o desocupación (art. 24).
- Sucesorio: 50 % de la tarifa sobre el valor de los bienes, mínimo ₡242.000 (art. 28). Medida cautelar: mínimo ₡121.000 (art. 25).
En la app: al abrir el expediente elige «Por proceso», el servicio del tarifario y la cuantía; la pestaña Cobro reparte los honorarios en etapas y cada etapa se factura cuando se cumple.`,
  },
  {
    title: "Honorarios notariales: escrituras, traspasos, sociedades y poderes",
    area: "notarial",
    keywords: "honorarios notariales escritura traspaso compraventa vehículo carro inmueble hipoteca sociedad poder testamento matrimonio tarifa notarial cuánto cobro notario",
    refs: "",
    body: `Tarifa general notarial según la cuantía o valor real del acto (art. 74), mínimo ₡60.500: 2 % hasta ₡11.000.000; 1,5 % sobre el exceso hasta ₡16.500.000; 1,25 % sobre el exceso hasta ₡33.000.000; 1 % sobre el exceso.
- Traspaso de vehículos, buques y aeronaves: tarifa general sobre el mayor entre valor fiscal y valor real, mínimo ₡60.500 (art. 82).
- Cancelación de hipoteca o prenda y otros actos del art. 75: mitad de la tarifa, mínimo ₡60.500.
- Segregación en cabeza propia o rectificación de medida: 25 % de la tarifa por finca, mínimo ₡60.500 (art. 76).
- Constitución de sociedades, asociaciones o fundaciones: mínimo ₡181.500; modificaciones y nombramientos: ₡90.750 (art. 95).
- Poderes: mínimo ₡90.750 (art. 96). Testamento: ₡121.000 (art. 97). Matrimonio: ₡121.000 (art. 94).
- Actos complejos: recargo del 50 % con convenio escrito; varias operaciones en un instrumento se cobran por separado (art. 71). Desplazamientos fuera de la oficina: pago adicional pactado (art. 73).
- Corregir errores propios no genera honorarios (art. 66).
Ejemplo: compraventa de ₡20.000.000 → ₡220.000 + ₡82.500 + ₡43.750 = ₡346.250.`,
  },
  {
    title: "Timbre del Colegio de Abogados y gastos del expediente",
    area: "despacho",
    keywords: "timbre del colegio de abogados timbres gastos derechos de registro viáticos cobrar aparte reembolso cuánto timbre escritura demanda",
    refs: "",
    body: `El timbre del Colegio se paga según la cuantía, con la misma escala para el escrito inicial de los procesos (art. 107) y para los instrumentos públicos (art. 108):
- Hasta ₡250.000: exento. Hasta ₡1.000.000: ₡1.100. Hasta ₡5.000.000: ₡2.200. Hasta ₡25.000.000: ₡5.500. Hasta ₡50.000.000: ₡11.000. De ₡50 a ₡100 millones: ₡16.500. De ₡100 a ₡500 millones: ₡27.500. Desde ₡500 millones: ₡55.000.
- Procesos de cuantía inestimable (salvo familia, trabajo y penal): ₡12.100. Instrumentos inestimables: ₡275 cada uno.
Los timbres, derechos de registro y viáticos no son honorarios: se cobran aparte al cliente y no llevan IVA. En la app se registran en la pestaña Cobro del expediente («Gastos, timbres y derechos de registro») y se marcan cuando el cliente los reembolsa.`,
  },
  {
    title: "Honorarios en procesos laborales, de familia, penales y constitucionales",
    area: "despacho",
    keywords: "honorarios laboral ordinario laboral riesgos del trabajo divorcio pensión alimentaria familia penal defensa amparo querella cuánto cobro porcentaje condenatoria",
    refs: "",
    body: `Laboral (art. 32): ordinario, del 25 % al 30 % de la condenatoria (o la absolutoria), mínimo ₡121.000; riesgos del trabajo, del 20 % al 25 %, mínimo ₡121.000. Otros procesos laborales: mínimo ₡121.000 (art. 36).
Familia: divorcio o separación por mutuo acuerdo, ₡181.500 (mitad con la homologación y mitad con la inscripción, art. 48); divorcio, unión de hecho, filiación o adopción sin gananciales, ₡181.500 (mitad al presentar y mitad con la sentencia); con gananciales, mínimo ₡242.000 (art. 49); pensión alimentaria, ₡181.500 (art. 50).
Penal: defensa ante Tribunal Unipersonal, mínimo ₡484.000, por tercios: investigación, audiencia preliminar y juicio; abreviado o medida alterna, 75 % (art. 38). Querella por delitos de acción privada: mínimo ₡363.000 (art. 43).
Constitucional: recurso de amparo, ₡181.500, pagado con la presentación (art. 46).`,
  },
];
