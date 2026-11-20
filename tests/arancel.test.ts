import { describe, expect, it } from "vitest";
import { arancelItem, arancelMinimum, searchArancel, splitStages, tarifaNotarial, tarifaProcesos, timbreColegio } from "../src/lib/arancel";

const C = (n: number) => n * 100;

describe("arancel: tarifas por tramos", () => {
  it("tarifa notarial (art. 74): 2 %, 1,5 %, 1,25 % y 1 % sobre el exceso", () => {
    expect(tarifaNotarial(C(10_000_000))).toBe(C(200_000));
    // 11M·2 % + 5,5M·1,5 % + 3,5M·1,25 %
    expect(tarifaNotarial(C(20_000_000))).toBe(C(220_000 + 82_500 + 43_750));
    // + 17M·1 % sobre el exceso de 33M
    expect(tarifaNotarial(C(50_000_000))).toBe(C(220_000 + 82_500 + 206_250 + 170_000));
  });
  it("tarifa de procesos (art. 16): 20 %, 15 % y 10 %", () => {
    expect(tarifaProcesos(C(1_000_000))).toBe(C(200_000));
    expect(tarifaProcesos(C(20_000_000))).toBe(C(3_300_000 + 525_000));
    expect(tarifaProcesos(C(100_000_000))).toBe(C(3_300_000 + 9_900_000 + 1_750_000));
  });
  it("timbre del Colegio (arts. 107 y 108)", () => {
    expect(timbreColegio(C(200_000))).toBe(0);
    expect(timbreColegio(C(800_000))).toBe(C(1_100));
    expect(timbreColegio(C(20_000_000))).toBe(C(5_500));
    expect(timbreColegio(C(600_000_000))).toBe(C(55_000));
    expect(timbreColegio(0, { inestimable: true, proceso: true })).toBe(C(12_100));
  });
});

describe("arancel: mínimos por asunto", () => {
  it("traspaso de vehículo barato: se aplica el mínimo de ₡60.500", () => {
    const r = arancelMinimum(arancelItem("traspaso_vehiculo")!, C(3_000_000));
    expect(r.minCents).toBe(C(60_500));
    expect(r.explanation).toContain("mínimo");
  });
  it("traspaso de inmueble de ₡20 millones", () => {
    expect(arancelMinimum(arancelItem("traspaso_inmueble")!, C(20_000_000)).minCents).toBe(C(346_250));
  });
  it("monitorio: la mitad de la tarifa de procesos", () => {
    expect(arancelMinimum(arancelItem("monitorio")!, C(1_000_000)).minCents).toBe(C(100_000));
  });
  it("laboral: rango del 25 % al 30 %", () => {
    const r = arancelMinimum(arancelItem("laboral_ordinario")!, C(2_000_000));
    expect([r.minCents, r.maxCents]).toEqual([C(500_000), C(600_000)]);
  });
  it("sin cuantía: explica cómo se calcula", () => {
    const r = arancelMinimum(arancelItem("traspaso_inmueble")!, null);
    expect(r.needsBase).toBe(true);
    expect(r.explanation).toMatch(/tarifa general notarial/);
  });
  it("hora profesional y ajuste del art. 112 (solo montos)", () => {
    expect(arancelMinimum(arancelItem("hora")!, null).minCents).toBe(C(90_750));
    expect(arancelMinimum(arancelItem("hora")!, null, 500).minCents).toBe(C(95_288));
    expect(arancelMinimum(arancelItem("traspaso_inmueble")!, C(20_000_000), 500).minCents).toBe(C(346_250));
  });
});

describe("arancel: etapas y búsqueda", () => {
  it("reparte el total y suma exacto", () => {
    const s = splitStages(C(1_000_000), arancelItem("proceso_cuantia")!.stages!);
    expect(s).toHaveLength(3);
    expect(s.reduce((a, x) => a + x.amountCents, 0)).toBe(C(1_000_000));
  });
  it("encuentra por palabras habituales", () => {
    expect(searchArancel("cuánto cobro por un traspaso de carro")[0].key).toBe("traspaso_vehiculo");
    expect(searchArancel("constitución de una sociedad anónima")[0].key).toBe("sociedad");
    expect(searchArancel("pensión alimentaria")[0].key).toBe("pension");
    expect(searchArancel("honorarios")).toEqual([]);
  });
});

import { parsePercentToBp, parseStages, profitability, suggestFee, type ServiceLike } from "../src/lib/fees";

const svc = (o: Partial<ServiceLike>): ServiceLike => ({ name: "S", mode: "fijo", amountCents: null, hourlyRateCents: null, percentBp: null, minimumCents: null, markupBp: 0, arancelKey: null, stages: [], ...o });

describe("tarifario del despacho", () => {
  it("monto fijo, comparado con el arancel", () => {
    const s = suggestFee(svc({ mode: "fijo", amountCents: C(50_000), arancelKey: "traspaso_vehiculo" }), C(2_000_000));
    expect(s.amountCents).toBe(C(50_000));
    expect(s.belowArancel).toBe(true);
    expect(suggestFee(svc({ mode: "fijo", amountCents: C(80_000), arancelKey: "traspaso_vehiculo" }), C(2_000_000)).belowArancel).toBe(false);
  });
  it("porcentaje con mínimo", () => {
    expect(suggestFee(svc({ mode: "porcentaje", percentBp: 250, minimumCents: C(100_000) }), C(20_000_000)).amountCents).toBe(C(500_000));
    expect(suggestFee(svc({ mode: "porcentaje", percentBp: 250, minimumCents: C(100_000) }), C(1_000_000)).amountCents).toBe(C(100_000));
    expect(suggestFee(svc({ mode: "porcentaje", percentBp: 250 }), null)).toMatchObject({ amountCents: null, needsBase: true });
  });
  it("según el arancel, con recargo", () => {
    expect(suggestFee(svc({ mode: "arancel", arancelKey: "traspaso_inmueble", markupBp: 1000 }), C(20_000_000)).amountCents).toBe(C(380_875));
    expect(suggestFee(svc({ mode: "arancel", arancelKey: "sociedad" }), null).amountCents).toBe(C(181_500));
  });
  it("por horas: tarifa y mínimo del arancel por hora", () => {
    const s = suggestFee(svc({ mode: "horas", hourlyRateCents: C(60_000), arancelKey: "hora" }), null);
    expect(s).toMatchObject({ perHour: true, amountCents: C(60_000), belowArancel: true });
  });
  it("rendimiento por hora efectiva", () => {
    expect(profitability(C(300_000), 120, C(180_000))).toMatchObject({ perHourCents: C(150_000), diffCents: C(120_000) });
  });
  it("lee porcentajes y etapas", () => {
    expect(parsePercentToBp("2,5 %")).toBe(250);
    expect(parsePercentToBp("abc")).toBeNull();
    expect(parseStages("Presentación 50\nSentencia 50")).toEqual({ stages: [{ name: "Presentación", percent: 50 }, { name: "Sentencia", percent: 50 }] });
    expect(parseStages("Demanda 40; Pruebas 30; Sentencia 20")).toHaveProperty("error");
    expect(parseStages("")).toEqual({ stages: [] });
  });
});

import { extractAmountCents } from "../src/lib/fees";
describe("importes en lenguaje natural", () => {
  it("lee millones, mil y colones", () => {
    expect(extractAmountCents("traspaso de un carro de 5 millones")).toBe(C(5_000_000));
    expect(extractAmountCents("compraventa de ₡20.000.000")).toBe(C(20_000_000));
    expect(extractAmountCents("una casa de 3,5 millones")).toBe(C(3_500_000));
    expect(extractAmountCents("800 mil colones")).toBe(C(800_000));
    expect(extractAmountCents("cuánto cobro por una sociedad")).toBeNull();
    expect(extractAmountCents("despido con 2 años")).toBeNull();
  });
});
