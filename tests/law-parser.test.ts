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
    expect(articleNumbersFrom("Artículos 1, 2 y 5")).toEqual(["1", "2", "5"]);
    expect(articleNumbersFrom("31 al 33")).toEqual(["31", "32", "33"]);
    expect(articleNumbersFrom("97 bis")).toEqual(["97 bis"]);
    expect(articleNumbersFrom("1 al 500")).toEqual([]);
    expect(articleNumbersFrom(null)).toEqual([]);
  });
});
