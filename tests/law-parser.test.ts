import { describe, expect, it } from "vitest";
import { articleNumbersFrom, parseLawText } from "../src/lib/law-parser";

const SAMPLE = `Ley N° 2
CODIGO DE TRABAJO
TITULO PRIMERO

DISPOSICIONES GENERALES

CAPITULO PRIMERO

Disposiciones generales

ARTICULO 1º.- El presente Código regula los derechos y obligaciones.

ARTICULO 2º.-

Patrono es toda persona física o jurídica.

(Así reformado por la ley N° 123)

Ficha Artículo 2

TITULO TERCERO
DE LAS JORNADAS
CAPITULO TERCERO
De los días feriados, de los descansos semanales y de las
vacaciones obligatorias
SECCION I
Artículo 97bis- La persona empleadora deberá procurar espacios de lactancia.
Artículo 148.- Se considerarán días feriados los siguientes.
Este artículo 5 de la ley no es un artículo nuevo.
ARTICULO XII.- Publíquese.
Ir al menú de normativa
Poder Judicial`;

describe("textos de leyes: separar artículos", () => {
  const arts = parseLawText(SAMPLE);
  it("encuentra los artículos con su número normalizado y sin el rótulo", () => {
    expect(arts.map((a) => a.number)).toEqual(["1", "2", "97 bis", "148", "XII"]);
    expect(arts[0].body).toBe("El presente Código regula los derechos y obligaciones.");
    expect(arts[1].body).toContain("Patrono es toda persona");
    expect(arts[1].body).toContain("(Así reformado por la ley N° 123)");
    expect(arts[1].body).not.toContain("Ficha");
  });
  it("ubica cada artículo en su título, capítulo y sección (nombres en dos líneas incluidos)", () => {
    expect(arts[0].heading).toBe("Titulo primero: Disposiciones generales · Capitulo primero: Disposiciones generales");
    expect(arts[2].heading).toBe(
      "Titulo tercero: De las jornadas · Capitulo tercero: De los días feriados, de los descansos semanales y de las vacaciones obligatorias · Seccion I",
    );
  });
  it("una mención («Este artículo 5…») no abre artículo nuevo; el pie de página se descarta", () => {
    expect(arts[3].body).toContain("Este artículo 5 de la ley");
    expect(arts.at(-1)!.body).toBe("Publíquese.");
  });
});

describe("textos de leyes: números citados", () => {
  it("interpreta listas, rangos y bis", () => {
    expect(articleNumbersFrom("29")).toEqual(["29"]);
    expect(articleNumbersFrom("28 y 29")).toEqual(["28", "29"]);
    expect(articleNumbersFrom("Único")).toEqual(["Único"]);
    expect(articleNumbersFrom("66-C y 66-ch")).toEqual(["66-C", "66-CH"]);
    expect(articleNumbersFrom("Artículos 1, 2 y 5")).toEqual(["1", "2", "5"]);
    expect(articleNumbersFrom("31 al 33")).toEqual(["31", "32", "33"]);
    expect(articleNumbersFrom("97 bis")).toEqual(["97 bis"]);
    expect(articleNumbersFrom("1 al 500")).toEqual([]);
    expect(articleNumbersFrom(null)).toEqual([]);
  });
});

describe("notas de SINALEVI con texto futuro", () => {
  it("el artículo repetido dentro de la nota no es un artículo nuevo", () => {
    const t = [
      "Artículo 117.- Homicidio culposo",
      "Se impondrá prisión de seis meses a ocho años.",
      "(Nota de Sinalevi: Mediante la Ley N° 10860 se reformará este numeral; a partir de esa fecha el texto de este numeral se leerá de la siguiente manera: “Homicidio culposo",
      "Artículo 117- Se impondrá prisión de uno a diez años.”)",
      "Artículo 118.- Otro",
      "Texto.",
    ].join("\n");
    const arts = parseLawText(t);
    expect(arts.map((x) => x.number)).toEqual(["117", "118"]);
    expect(arts[0].body).toContain("uno a diez años");
  });
});

import { joinArticleNumbers } from "../src/lib/law-parser";
describe("varios artículos elegidos", () => {
  it("agrupa consecutivos y vuelve a leerse igual", () => {
    expect(joinArticleNumbers(["31", "28", "29", "30", "45", "97 bis"])).toBe("28 a 31, 45 y 97 bis");
    expect(joinArticleNumbers(["29", "30"])).toBe("29 y 30");
    expect(joinArticleNumbers(["7"])).toBe("7");
    expect(articleNumbersFrom(joinArticleNumbers(["28", "29", "30", "31", "45", "97 bis"]))).toEqual(["28", "29", "30", "31", "45", "97 bis"]);
  });
});

describe("artículo de reformas", () => {
  it("los artículos de otras leyes que cita quedan dentro de él", () => {
    const t = ["Artículo 184.- Reformas", "Se reforman las siguientes disposiciones legales:", "Artículo 543.- En los asuntos del albacea…", "Artículo 55.- La Sala Segunda conocerá…", "Artículo 185.- Se autoriza a la Corte…"].join("\n");
    const arts = parseLawText(t);
    expect(arts.map((a) => a.number)).toEqual(["184", "185"]);
    expect(arts[0].body).toContain("Sala Segunda");
  });
});
