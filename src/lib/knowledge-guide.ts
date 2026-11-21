/**
 * Guía inicial de la base de conocimiento (Costa Rica). Redactada a partir del texto vigente del
 * Código de Trabajo (versión 64) y del Código Procesal Civil (Ley 9342, versión 5), consultados en el
 * SCIJ, y del Arancel de honorarios de abogacía y notariado (Decreto 41457-JP reformado por el 41930-JP,
 * SINALEVI versión 4 de 4), del Código Procesal Penal (Ley 7594, versión 47) y del Código Penal
 * (Ley 4573, versión 104), del Código de Familia (Ley 5476, versión 43) y del Código Procesal de Familia
 * (Ley 9747, versión 4, vigente desde el 1 de octubre de 2024), del Código Civil (Ley 30 de 1885, versión
 * 22) y de la Ley de la Jurisdicción Constitucional (Ley 7135, versión 6). Se carga marcada como «sin revisar»: el despacho debe revisarla y completarla.
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
  {
    title: "Prescripción de la acción penal: plazos y cómputo",
    area: "penal",
    keywords: "prescripción acción penal delito prescribe cuándo prescribe plazo máximo de la pena tres diez años contravención interrupción indagatoria mitad suspensión rebeldía menor de edad",
    refs: "ley-7594:31,32,33,34",
    body: `Si no se ha iniciado la persecución penal, la acción prescribe (art. 31 CPP):
- Delitos con prisión: en un plazo igual al máximo de la pena, que no puede pasar de 10 años ni bajar de 3. Si la víctima es menor de edad, corre desde que cumple la mayoría de edad.
- Penas no privativas de libertad, faltas o contravenciones: 2 años (personas jurídicas: 10 años).
- Delitos sexuales contra menores de edad: 25 años desde que la víctima cumple la mayoría de edad.
- Corrupción (Ley 8422) y delitos contra los deberes de la función pública: 30 años desde la consumación.
Corre desde la consumación; en la tentativa, desde el último acto de ejecución; en el delito continuo o permanente, desde que cesó; y para cada imputado por separado (art. 32).
Iniciado el procedimiento, el plazo se reduce a la mitad y se interrumpe con: la indagatoria, la presentación de la querella (acción privada), la resolución que convoca a la audiencia preliminar, el señalamiento del debate, la suspensión del debate por causas atribuibles a la defensa y la sentencia aunque no esté firme (art. 33). Se suspende, entre otros, durante un criterio de oportunidad, una suspensión del proceso a prueba o la rebeldía (art. 34).
Para calcularla: Herramientas → Prescripción penal.`,
  },
  {
    title: "Recursos en el proceso penal: plazos",
    area: "penal",
    keywords: "recurso penal plazo revocatoria apelación apelar sentencia penal casación penal días hábiles adhesión tribunal de apelación de sentencia",
    refs: "ley-7594:167,450,453,460,461,469",
    body: `Los plazos corren desde el día siguiente a la notificación y, si son por días, solo cuentan los hábiles (art. 167 CPP).
- Revocatoria: por escrito fundado dentro de los 3 días siguientes a la notificación; en las audiencias orales, en la misma audiencia (art. 450).
- Apelación (resoluciones de las etapas previas al juicio): se interpone en la misma audiencia en que se dictó; si la resolución se dictó fuera de audiencia o por escrito, dentro de los 3 días siguientes a la notificación (art. 453). Las otras partes tienen 3 días para contestar (art. 454).
- Apelación de sentencia: ante el tribunal que la dictó, dentro de 15 días de notificada, expresando los fundamentos, el agravio y la pretensión, y ofreciendo la prueba (art. 460). Luego se da audiencia de 5 días a los interesados, que pueden adherirse (art. 461).
- Casación: ante el tribunal que dictó la sentencia de apelación, dentro de 15 días de notificada, bajo pena de inadmisibilidad, con cada motivo por separado (art. 469).
Para calcular el vencimiento: Herramientas → Vencimiento de un plazo procesal (días hábiles).`,
  },
  {
    title: "Medidas alternas: conciliación, suspensión del proceso a prueba y reparación integral",
    area: "penal",
    keywords: "medidas alternas conciliación suspensión del proceso a prueba reparación integral del daño plan de reparación cinco años extinción de la acción penal justicia restaurativa",
    refs: "ley-7594:25,26,28,30,36",
    body: `Todas proceden hasta antes de acordarse la apertura a juicio (la reparación integral, antes del juicio oral), y no se pueden usar si el imputado se benefició de alguna de ellas en los cinco años anteriores.
- Conciliación (art. 36): en faltas o contravenciones, delitos de acción privada o de acción pública a instancia privada, delitos que admitan la suspensión condicional de la pena y delitos solo con penas no privativas de libertad. El tribunal homologa los acuerdos; la acción se extingue cuando se cumplen (plazo máximo de un año, prorrogable hasta seis meses por causa justa). No se aprueba en delitos contra personas menores de edad; en delitos sexuales, agresiones domésticas y Ley 8589 no se promueve salvo que la víctima lo pida.
- Suspensión del proceso a prueba (art. 25): cuando procede la suspensión condicional de la pena o en delitos con penas no privativas de libertad; no en delitos dolosos con fuerza en las cosas o violencia sobre las personas. Requiere un plan de reparación, que el imputado admita el hecho y la conformidad de la víctima. El plazo de prueba es de 2 a 5 años con reglas de conducta (art. 26); si se incumple, puede reanudarse el proceso o ampliarse el plazo hasta 2 años más, una sola vez (art. 28). Cumplido, se extingue la acción (art. 30 f).
- Reparación integral del daño (art. 30 j): a entera satisfacción de la víctima, en delitos patrimoniales sin fuerza en las cosas ni violencia sobre las personas y en delitos culposos, si la víctima o el Ministerio Público la admiten.`,
  },
  {
    title: "Prisión preventiva: requisitos, duración y prórrogas",
    area: "penal",
    keywords: "prisión preventiva requisitos peligro de fuga obstaculización duración doce meses prórroga cesación medida cautelar",
    refs: "ley-7594:239,257,258",
    body: `Procede cuando concurren (art. 239 CPP): elementos de convicción suficientes de que el imputado es, con probabilidad, autor o partícipe; presunción razonable de peligro de fuga, de obstaculización o de que continuará la actividad delictiva; que el delito tenga pena privativa de libertad; o peligro para la víctima, la persona denunciante o el testigo.
Duración: termina cuando excede de doce meses, cuando su duración iguala o supera la posible pena, o cuando nuevos elementos muestran que no concurren sus motivos (art. 257). Prórrogas (art. 258): a pedido del Ministerio Público, el Tribunal de Apelación de Sentencia puede prorrogarla hasta un año más, fijando el tiempo concreto; con sentencia condenatoria a prisión, puede prorrogarse seis meses más por resolución fundada.`,
  },
  {
    title: "Acción penal: pública, a instancia privada y privada (querella)",
    area: "penal",
    keywords: "acción penal pública instancia privada acción privada querella delitos contra el honor difamación injurias calumnias lesiones leves amenazas violación de domicilio usurpación",
    refs: "ley-7594:18,19,72",
    body: `Delitos de acción pública perseguibles solo a instancia privada (art. 18 CPP): entre otros, el contagio de enfermedad y la violación de persona mayor de edad en pleno uso de razón; las agresiones sexuales no agravadas ni calificadas contra mayores de edad; las lesiones leves y las culposas que no vengan de un accidente de tránsito, el abandono de personas, las amenazas, la violación de domicilio y la usurpación; el incumplimiento del deber alimentario o de asistencia.
Delitos de acción privada (art. 19): los delitos contra el honor, la propaganda desleal y los que la ley califique así. Se persiguen por querella: toda persona con capacidad civil que se pretenda ofendida puede presentarla y ejercer junto con ella la acción civil resarcitoria (art. 72). La presentación de la querella interrumpe la prescripción (art. 33 b) y el desistimiento de la querella extingue la acción (art. 30 b).`,
  },
  {
    title: "Procedimiento abreviado",
    area: "penal",
    keywords: "procedimiento abreviado admitir los hechos rebaja de la pena un tercio acuerdo fiscal antes de la apertura a juicio",
    refs: "ley-7594:373,374",
    body: `Se puede proponer en cualquier momento hasta antes de acordarse la apertura a juicio, cuando el imputado admite el hecho que se le atribuye y consiente el procedimiento, y el Ministerio Público, el querellante y el actor civil están conformes (art. 373 CPP). Puede tramitarse por justicia restaurativa cuando proceda.
El Ministerio Público y el querellante formulan la acusación y piden la pena; el mínimo de la pena del tipo penal puede disminuirse hasta en un tercio. Se escucha a la víctima de domicilio conocido, pero su criterio no es vinculante (art. 374).`,
  },
  {
    title: "Ejecución condicional de la pena y prescripción de la pena",
    area: "penal",
    keywords: "ejecución condicional de la pena condena condicional tres años delincuente primario prescripción de la pena un tercio veinticinco años sentencia firme",
    refs: "ley-4573:59,60,84,86",
    body: `Ejecución condicional (Código Penal): el juez puede aplicarla cuando la pena no excede de tres años y consiste en prisión o extrañamiento (art. 59). Exige que se trate de un delincuente primario y se funda en su personalidad, su vida anterior, su comportamiento posterior al delito y su deseo de reparar; requiere un informe del Instituto de Criminología (art. 60).
Prescripción de la pena (art. 84): la de prisión, extrañamiento o interdicción de derechos, en un tiempo igual a la condena más un tercio, sin pasar de 25 años ni bajar de 3; los días multa por delitos, en 3 años; las contravenciones, en 1 año. Corre desde que la sentencia queda firme, o desde que se revoca la ejecución condicional o la libertad condicional, o desde el quebrantamiento de la condena (art. 86).
Para calcularla: Herramientas → Prescripción penal → De la pena impuesta.`,
  },
  {
    title: "Divorcio: causales y divorcio por mutuo consentimiento",
    area: "familia",
    keywords: "divorcio causales mutuo consentimiento convenio escritura pública registro civil separación de hecho tres años incompatibilidad de caracteres adulterio sevicia daños y perjuicios",
    refs: "ley-5476:48,48 bis",
    body: `Causales de divorcio (art. 48 del Código de Familia): el adulterio; el atentado contra la vida del otro cónyuge o de los hijos; la tentativa de prostituir o corromper al cónyuge o la corrupción de los hijos; la sevicia; la separación judicial por un año sin reconciliación; la ausencia legalmente declarada; la separación de hecho por al menos tres años; y la incompatibilidad de caracteres.
Mutuo consentimiento: los cónyuges, personalmente o uno por apoderado especialísimo en escritura pública, otorgan un convenio en escritura pública que diga: a) quién tiene la custodia de los hijos menores; b) quién asume su alimentación y en qué proporción; c) si hay o no obligación alimentaria entre los cónyuges y su monto; d) la propiedad y distribución de los bienes.
- Sin hijos menores comunes ni bienes en el convenio, la escritura va directamente al Registro Civil.
- Si hay hijos menores o bienes, se tramita judicialmente: el convenio se presenta al juzgado dentro de los tres meses siguientes a su otorgamiento, salvo que lo presenten ambos cónyuges juntos (reforma de la Ley 10650 de 2025). El tribunal puede modificar lo relativo a los hijos.
Por las causales 2), 3) y 4), el cónyuge inocente puede pedir daños y perjuicios junto con la acción (art. 48 bis).`,
  },
  {
    title: "Separación judicial: causales",
    area: "familia",
    keywords: "separación judicial causales abandono malicioso ofensas graves separación de hecho un año mutuo consentimiento",
    refs: "ley-5476:58,60",
    body: `Son causales de separación judicial (art. 58 del Código de Familia): cualquiera de las de divorcio; el abandono voluntario y malicioso; la negativa infundada a cumplir los deberes de asistencia y alimentación con el otro cónyuge o los hijos comunes; las ofensas graves; la enajenación mental de más de un año u otra enfermedad o trastorno grave que haga imposible o peligrosa la vida en común; la condena a tres o más años de prisión por delito no político, si el condenado estuvo preso al menos dos años consecutivos; y la separación de hecho durante un año consecutivo, después de dos años de matrimonio.
También procede por mutuo consentimiento, con las mismas reglas del convenio de divorcio del art. 48 (art. 60). La separación judicial por un año sin reconciliación es, a su vez, causal de divorcio.`,
  },
  {
    title: "Pensión alimentaria: qué comprende, aguinaldo, salario escolar y retroactivos",
    area: "familia",
    keywords: "pensión alimentaria alimentos cuota aguinaldo salario escolar inicio de lecciones quiénes deben alimentos retroactivos doce meses modificación aumento automático no tener trabajo",
    refs: "ley-5476:164,169,172,174;ley-9747:262,265,279",
    body: `Los alimentos comprenden sustento, habitación, vestido, asistencia médica, diversión, transporte y la educación o capacitación de los menores de edad o personas con discapacidad, según las posibilidades de quien los da y las necesidades y el nivel de vida de quien los recibe (art. 164 del Código de Familia).
- Aguinaldo: una cuota igual a la ordinaria, en los primeros veinte días de diciembre, sin necesidad de que se ordene (art. 164).
- Salario escolar o inicio de lecciones: una cuota igual a la ordinaria en enero, si el obligado recibe salario escolar y la persona beneficiaria tiene gastos de estudio; el juez puede fijar un monto anual (art. 164).
- Deben alimentos: los cónyuges entre sí; padres y madres a sus hijos menores o con discapacidad y los hijos a sus padres; hermanos, abuelos, nietos y bisnietos en los casos del art. 169.
- Alimentos pasados: solo los doce meses anteriores a la demanda y si hubo que endeudarse para vivir (art. 172); declarada la paternidad, la obligación se retrotrae a la presentación de la demanda (art. 96).
- La cuota puede modificarse si cambian las circunstancias (art. 174); lo resuelto sobre el monto no es cosa juzgada material (art. 262 CPF).
- No es excusa no tener trabajo, salario o ingresos, ni que el negocio no dé utilidades (art. 265 CPF).
- Aumento automático: si el obligado es asalariado, en enero y julio según el aumento de ley; si no, cada enero según la variación del salario base (art. 279 CPF).
La Ley de Pensiones Alimentarias (7654) está derogada: rige el Código Procesal de Familia. Para calcular: Herramientas → Familia.`,
  },
  {
    title: "Proceso de pensión alimentaria: conciliación, sentencia anticipada y oposición",
    area: "familia",
    keywords: "proceso pensión alimentaria demanda de alimentos conciliación diez días sentencia anticipada oposición cinco días retención salarial exigible tercer día",
    refs: "ley-9747:267,269,270,271,280",
    body: `Demanda (art. 267 CPF): si se piden alimentos para varias personas, se indica el monto pretendido para cada una; se puede pedir la retención salarial; no es obligatorio señalar medio para notificaciones (se notifica por estrados).
Audiencia previa de conciliación: dentro de los diez días hábiles siguientes a la presentación de la demanda (art. 269). El tribunal puede consultar antes las planillas de la CCSS o los ingresos ante el patrono.
Sentencia anticipada: si no hay audiencia en ese plazo o no hay arreglo, se dicta en las veinticuatro horas siguientes, con la cuota de cada beneficiario, el aguinaldo y el salario escolar, el aumento automático, los retroactivos si proceden y el apercibimiento de apremio corporal (art. 270).
Oposición: las partes pueden oponerse a la sentencia anticipada en cinco días, con referencia a los hechos, las pretensiones y la prueba; la oposición no suspende sus efectos (art. 271).
La cuota del acuerdo o de la sentencia anticipada es exigible por los medios coercitivos después del tercer día de notificada (art. 280).`,
  },
  {
    title: "Apremio corporal por deuda alimentaria",
    area: "familia",
    keywords: "apremio corporal deuda alimentaria cárcel por pensión seis mensualidades dos cuatro seis meses sesenta y cinco años allanamiento",
    refs: "ley-9747:283,284",
    body: `Si no se paga la deuda alimentaria, a petición de la parte acreedora se puede girar orden de apremio corporal contra la persona deudora mayor de edad y menor de sesenta y cinco años; cubre hasta seis mensualidades, incluida la presente, más aguinaldo, salario escolar o inicio de lecciones y gastos extraordinarios urgentes (art. 283 CPF).
- Gradualidad: la primera orden, hasta por dos meses; la segunda, hasta por cuatro; desde la tercera, hasta por seis.
- Se puede excluir a quien esté en estado avanzado de embarazo o en una condición de salud que el apremio agrave.
- Agotadas otras formas, puede pedirse el allanamiento del lugar donde se oculte la persona deudora.
Para calcular la deuda y lo que cubre el apremio: Herramientas → Familia → Pensión alimentaria.`,
  },
  {
    title: "Recursos y plazos en el proceso de familia",
    area: "familia",
    keywords: "plazos familia recurso revocatoria apelación casación contestación demanda ocho días proceso resolutivo familiar cómputo días hábiles",
    refs: "ley-9747:73,99,100,102,107,223",
    body: `Los plazos corren desde el día hábil siguiente a aquel en que se notificó a todas las partes; si son por días, solo cuentan los hábiles; por meses o años, de fecha a fecha; si vencen en día inhábil, pasan al siguiente hábil; los escritos electrónicos valen hasta las 24 horas del último día (art. 73 CPF).
- Revocatoria: dentro del tercer día; si la resolución se dictó en audiencia, en el mismo acto (art. 99).
- Apelación: solo contra las resoluciones que la ley indica, dentro del tercer día; contra autos se interpone junto con la revocatoria o se rechaza de plano; si se dictó en audiencia, en el acto (art. 100). Admitida, las otras partes tienen tres días para expresar agravios (art. 102).
- Casación: por escrito ante el órgano que dictó la sentencia, dentro de los diez días siguientes a la notificación; no hace falta citar normas, pero sí el derecho vulnerado (art. 107).
- Contestación de la demanda en el proceso resolutivo familiar: ocho días hábiles (art. 223).`,
  },
  {
    title: "Unión de hecho: requisitos y plazo para su reconocimiento",
    area: "familia",
    keywords: "unión de hecho reconocimiento convivencia dos años pública notoria única estable caducidad dos años gananciales efectos patrimoniales",
    refs: "ley-5476:245,246",
    body: `La unión de hecho pública, notoria, única y estable por más de dos años, entre dos personas con aptitud legal para casarse, produce todos los efectos patrimoniales del matrimonio (art. 245 del Código de Familia).
Cualquiera de los convivientes, o la sucesión del fallecido, puede pedir su reconocimiento; la acción caduca en dos años desde la ruptura de la convivencia o la muerte del conviviente (art. 246). También puede reconocerse por mutuo consentimiento, una vez finalizada, con escritura pública como la del divorcio (art. 48), que incluya la declaración de al menos dos personas sobre la existencia de la unión.
Para calcular el plazo: Herramientas → Familia → Plazos de familia.`,
  },
  {
    title: "Bienes gananciales: qué son y cuándo se reparten",
    area: "familia",
    keywords: "gananciales bienes gananciales liquidación mitad del valor neto divorcio separación capitulaciones bienes propios título gratuito",
    refs: "ley-5476:41",
    body: `Al disolverse o anularse el matrimonio, al declararse la separación judicial o al celebrarse capitulaciones después de la boda, cada cónyuge tiene derecho a la mitad del valor neto de los bienes gananciales que haya en el patrimonio del otro; esos bienes quedan gravados de pleno derecho a las resultas de la liquidación (art. 41 del Código de Familia).
Puede pedirse la liquidación anticipada si se demuestra que la mala gestión o los actos del otro cónyuge ponen en riesgo los intereses propios.
No son gananciales, entre otros: los adquiridos por título gratuito (herencia, donación) o por causa aleatoria; los comprados con valores propios destinados a ello en capitulaciones; aquellos cuya causa de adquisición es anterior al matrimonio; y los que sustituyen a bienes propios.`,
  },
  {
    title: "Responsabilidad parental, custodia e interrelación familiar",
    area: "familia",
    keywords: "responsabilidad parental patria potestad custodia compartida régimen de interrelación familiar visitas interés superior del menor divorcio hijos",
    refs: "ley-5476:151,152",
    body: `El padre y la madre ejercen con iguales derechos y deberes la responsabilidad parental sobre sus hijos; en caso de conflicto, el tribunal decide mediante el proceso resolutivo familiar, incluido el régimen de interrelación familiar, según el interés superior de la persona menor de edad (art. 151 del Código de Familia).
En el divorcio, la nulidad o la separación, los cónyuges acuerdan —o el tribunal dispone— la custodia y el ejercicio de la responsabilidad parental, siendo prioritaria la custodia compartida; la alimentación, crianza y educación de los hijos en proporción a los ingresos de cada uno; y el régimen de interrelación familiar, que incluye el contacto con los parientes hasta el cuarto grado de consanguinidad y segundo de afinidad (art. 152). Debe asegurarse el derecho a la vivienda de los hijos menores.`,
  },
  {
    title: "Prescripción civil: diez, tres y un año",
    area: "civil",
    keywords: "prescripción civil deuda cobro diez años tres años un año honorarios alquileres intereses interrupción reconocimiento gestión de cobro exigible",
    refs: "ley-63:868,869,870,874,876,878,879,880",
    body: `Regla general: todo derecho y su acción prescriben a los diez años; para daños y perjuicios a una persona menor de edad, el plazo corre desde que cumple la mayoría de edad (art. 868 del Código Civil).
- Tres años (art. 869): intereses, alquileres, pensiones y rentas pagaderos por semestre o por un período mayor; sueldos, honorarios o emolumentos de servicios profesionales; obras por destajo; cobro por el uso de bienes muebles.
- Un año (art. 870): intereses, alquileres o rentas pagaderos por períodos menores de un semestre; ventas de comerciantes directamente a consumidores; obras de artesanos.
El plazo corre desde que la obligación es exigible (art. 874). Se interrumpe con el reconocimiento expreso o tácito del deudor, el emplazamiento, embargo o secuestro notificado (art. 876) y, en la prescripción negativa, con cualquier gestión judicial o extrajudicial de cobro (art. 879); el tiempo anterior se pierde (art. 878). No corre contra menores o incapaces sin representante, ni entre padres e hijos mientras dure la responsabilidad parental, entre otros casos (art. 880).
Para calcularla: Herramientas → Civil y constitucional.`,
  },
  {
    title: "Responsabilidad civil extracontractual (daños y perjuicios)",
    area: "civil",
    keywords: "responsabilidad civil extracontractual daños y perjuicios dolo culpa negligencia imprudencia indemnización reparar",
    refs: "ley-63:1045,868",
    body: `Todo aquel que por dolo, falta, negligencia o imprudencia causa a otro un daño está obligado a repararlo junto con los perjuicios (art. 1045 del Código Civil). Es la base de la responsabilidad civil extracontractual; la acción prescribe en el plazo general de diez años (art. 868) y, si el dañado es menor de edad, corre desde que cumple la mayoría de edad.
En el divorcio por las causales de atentado, corrupción o sevicia, el cónyuge inocente puede reclamar daños y perjuicios con base en este artículo (art. 48 bis del Código de Familia).`,
  },
  {
    title: "Bienes inembargables",
    area: "civil",
    keywords: "inembargable inembargables embargo salario pensión menaje herramientas de trabajo bienes que no se pueden embargar",
    refs: "ley-63:984",
    body: `No pueden ser embargados ni secuestrados, entre otros (art. 984 del Código Civil): los sueldos, en la parte que el Código de Trabajo declara inembargable; las jubilaciones, pensiones y beneficios sociales del deudor y las pensiones alimenticias; el menaje de casa, los artículos de uso doméstico y la ropa necesarios para el deudor, su cónyuge y sus hijos dependientes que vivan con él; los libros, máquinas y útiles necesarios para su profesión u oficio; y los útiles e instrumentos del artesano o agricultor, en las condiciones que indica la norma.`,
  },
  {
    title: "Recurso de amparo: cuándo procede y plazo",
    area: "constitucional",
    keywords: "recurso de amparo sala constitucional sala cuarta derechos fundamentales plazo dos meses amparo contra particulares requisitos",
    refs: "ley-7135:29,31,35,38,57,60",
    body: `Plazo del amparo: se puede interponer en cualquier momento mientras subsista la violación y hasta dos meses después de que cesen totalmente sus efectos directos; si el derecho es puramente patrimonial o se puede consentir, dentro de los dos meses desde la noticia fehaciente (art. 35 de la Ley de la Jurisdicción Constitucional). Fuera de plazo es inadmisible (art. 60).
Protege los derechos y libertades fundamentales (salvo los del hábeas corpus) contra toda disposición, acuerdo, resolución, acción, omisión o simple actuación material de servidores y órganos públicos que los haya violado, viole o amenace violar (art. 29).
- No hace falta agotar la vía administrativa; si se usan los recursos administrativos, el plazo se suspende mientras la Administración no resuelva (art. 31).
- Requisitos: el hecho u omisión, el derecho violado, el servidor u órgano autor y las pruebas; no hace falta citar la norma constitucional ni autenticación, y puede presentarse por memorial u otro medio escrito (art. 38).
- Contra sujetos de derecho privado procede cuando ejercen funciones públicas o están en una posición de poder frente a la cual los remedios comunes son insuficientes o tardíos (art. 57).`,
  },
  {
    title: "Hábeas corpus: libertad e integridad personales",
    area: "constitucional",
    keywords: "hábeas corpus habeas corpus libertad detención ilegítima integridad personal libertad de tránsito sala constitucional informe tres días",
    refs: "ley-7135:15,16,18,19",
    body: `Procede para garantizar la libertad e integridad personales contra actos u omisiones de cualquier autoridad, incluso judicial, contra las amenazas y las perturbaciones o restricciones indebidas, y contra las restricciones ilegítimas del derecho a trasladarse dentro del país y a permanecer, salir e ingresar en él (art. 15 de la Ley de la Jurisdicción Constitucional). También se resuelven las otras violaciones conexas con la libertad personal (art. 16).
Lo puede interponer cualquier persona, por memorial, telegrama u otro medio escrito, sin autenticación (art. 18). Se tramita de inmediato: el magistrado pide informe a la autoridad en un plazo que no puede exceder de tres días y ordena no ejecutar actos que hagan ineficaz lo que se resuelva; si no se conoce la autoridad, se tiene por interpuesto contra el jerarca (art. 19).`,
  },
  {
    title: "Acción de inconstitucionalidad: cuándo cabe",
    area: "constitucional",
    keywords: "acción de inconstitucionalidad leyes inconstitucionales asunto previo pendiente intereses difusos sala constitucional",
    refs: "ley-7135:73,75",
    body: `Cabe, entre otros supuestos, contra las leyes y disposiciones generales, incluso de sujetos privados, que infrinjan una norma o principio constitucional; contra actos subjetivos de autoridades públicas que no sean susceptibles de hábeas corpus o amparo; y cuando en la formación de las leyes se viole un trámite sustancial (art. 73 de la Ley de la Jurisdicción Constitucional).
Requiere un asunto pendiente ante los tribunales (incluidos hábeas corpus y amparo) o en el agotamiento de la vía administrativa, en el que se invoque la inconstitucionalidad como medio razonable de amparar el derecho lesionado. No hace falta cuando no hay lesión individual y directa, cuando se defienden intereses difusos o colectivos, ni cuando la interponen el Contralor, el Procurador, el Fiscal General o el Defensor de los Habitantes (art. 75).`,
  },
];
