/**
 * Banco de frases para redactar una contestación (estilo forense costarricense). Se insertan donde está el
 * cursor; lo que hay que completar va entre [PENDIENTE: …] para encontrarlo después. Sin citas de artículos
 * concretos: las normas se añaden con el buscador de leyes.
 */
export type Phrase = { label: string; text: string };
export type PhraseGroup = { key: string; title: string; phrases: Phrase[] };

export function phraseGroups(opts: { female?: boolean } = {}): PhraseGroup[] {
  const rep = opts.female === false ? "mi representado" : "mi representada";
  const Rep = rep.charAt(0).toUpperCase() + rep.slice(1);
  return [
    {
      key: "hechos",
      title: "Responder un hecho",
      phrases: [
        { label: "Es cierto", text: "Es cierto." },
        { label: "Cierto, según documento", text: "Es cierto, según consta en [PENDIENTE: documento] aportado por la parte actora." },
        { label: "Parcialmente cierto", text: "Es parcialmente cierto: es cierto que [PENDIENTE]; sin embargo, no es cierto que [PENDIENTE], por cuanto [PENDIENTE]." },
        { label: "No es cierto, lo cierto es…", text: "No es cierto. Lo cierto es que [PENDIENTE: versión de los hechos], tal como se demostrará con [PENDIENTE: prueba]." },
        { label: "Impreciso", text: "Se rechaza por impreciso: la parte actora no indica fechas, lugares ni circunstancias concretas que permitan contestarlo." },
        { label: "Sin prueba", text: "Se rechaza, por cuanto la parte actora no aporta prueba alguna que respalde su afirmación." },
        { label: "No le consta", text: `No le consta a ${rep}, por tratarse de un hecho ajeno a su conocimiento.` },
        { label: "Apreciación subjetiva", text: "No es un hecho, sino una apreciación subjetiva de la parte actora que no requiere pronunciamiento." },
        { label: "Cita normativa", text: "No es un hecho, sino una cita normativa que corresponde al fundamento de derecho." },
        { label: "Rechazar imputación", text: `Se rechaza categóricamente que ${rep} haya incurrido en las conductas que se le atribuyen. [PENDIENTE: versión y prueba].` },
      ],
    },
    {
      key: "pretensiones",
      title: "Pretensiones",
      phrases: [
        { label: "Me allano", text: "Me allano a esta pretensión." },
        { label: "Allanamiento sin aceptar hechos", text: "Me allano a esta pretensión, sin que ello implique aceptar los hechos que la parte actora atribuye a " + rep + "." },
        { label: "Me opongo", text: "Me opongo a esta pretensión, por las razones expuestas al contestar los hechos." },
        { label: "Oposición parcial", text: "Me opongo parcialmente: acepto [PENDIENTE], pero me opongo a [PENDIENTE], por cuanto [PENDIENTE]." },
        { label: "Sin costas", text: "Solicito que se resuelva sin especial condena en costas, por existir motivo suficiente para litigar." },
        { label: "Costas a la actora", text: "Solicito que se condene a la parte actora al pago de ambas costas del proceso." },
      ],
    },
    {
      key: "familia",
      title: "Familia",
      phrases: [
        { label: "No se opone al divorcio", text: `${Rep} no se opone a la disolución del vínculo matrimonial, sin que ello implique aceptar los hechos que se le atribuyen.` },
        { label: "Interés superior", text: "Lo que se resuelva debe atender al interés superior de la persona menor de edad, que [PENDIENTE: circunstancias concretas]." },
        { label: "Pensión para la persona menor", text: "Solicito que se fije una pensión alimentaria a favor de [PENDIENTE: nombre] por la suma mensual de [PENDIENTE], más aguinaldo y gastos escolares, considerando sus necesidades y la capacidad económica del actor." },
        { label: "Interrelación según horarios", text: "Solicito que el régimen de interrelación familiar se ajuste a los horarios escolares y a las actividades de la persona menor de edad, en los siguientes términos: [PENDIENTE]." },
        { label: "Aportes a los gananciales", text: `${Rep} contribuyó a la adquisición y mejora del bien con [PENDIENTE: dinero, trabajo en el hogar, pagos de crédito], lo cual se acreditará con [PENDIENTE: prueba].` },
      ],
    },
    {
      key: "prueba",
      title: "Prueba",
      phrases: [
        { label: "Testigo propio", text: "Testimonial: [PENDIENTE: nombre completo], mayor, [PENDIENTE: estado civil, profesión], vecino(a) de [PENDIENTE], quien declarará sobre los hechos [PENDIENTE: números]." },
        { label: "Documento propio", text: "Documental: [PENDIENTE: documento], que acredita [PENDIENTE]." },
        { label: "Declaración de la actora", text: "Declaración de parte: solicito que se cite a la parte actora a declarar sobre los hechos [PENDIENTE: números]." },
        { label: "Objetar testigos genéricos", text: "Me opongo a la prueba testimonial ofrecida, pues no se indica sobre qué hechos concretos declarará cada testigo." },
        { label: "Documento sin valor probatorio", text: "Dicho documento no acredita lo que pretende la parte actora, pues únicamente demuestra [PENDIENTE]." },
      ],
    },
    {
      key: "conectores",
      title: "Conectores",
      phrases: [
        { label: "Asimismo", text: "Asimismo, " },
        { label: "Por otra parte", text: "Por otra parte, " },
        { label: "No obstante lo anterior", text: "No obstante lo anterior, " },
        { label: "En consecuencia", text: "En consecuencia, " },
        { label: "Aunado a lo anterior", text: "Aunado a lo anterior, " },
        { label: "Por lo expuesto", text: "Por lo expuesto, " },
        { label: "Tal y como se demostrará", text: "tal y como se demostrará en la etapa procesal oportuna" },
      ],
    },
  ];
}

/** Inserta un texto en la posición del cursor, con un espacio de separación si hace falta. */
export function insertAt(current: string, start: number, end: number, text: string): { value: string; caret: number } {
  const s = Math.max(0, Math.min(start, current.length));
  const e = Math.max(s, Math.min(end, current.length));
  const before = current.slice(0, s);
  const after = current.slice(e);
  const pad = before && !/[\s(«"]$/.test(before) ? " " : "";
  const padAfter = after && !/^[\s.,;:)»"]/.test(after) && !/\s$/.test(text) ? " " : "";
  const value = `${before}${pad}${text}${padAfter}${after}`;
  return { value, caret: before.length + pad.length + text.length };
}

/** Posiciones de los [PENDIENTE…] de un texto. */
export function pendingPositions(text: string): { index: number; length: number; text: string }[] {
  return [...text.matchAll(/\[PENDIENTE[^\]]*\]/g)].map((m) => ({ index: m.index!, length: m[0].length, text: m[0] }));
}
