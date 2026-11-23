import { describe, expect, it } from "vitest";
import { checkDepositRemoval, checkWithdrawal, fundBalance, fundsStatus, maxApplicable, runningBalances } from "../src/lib/funds";

describe("provisión de fondos", () => {
  const rows = [
    { kind: "deposito" as const, amountCents: 100_000_00 },
    { kind: "gasto" as const, amountCents: 12_500_00 },
    { kind: "aplicacion" as const, amountCents: 50_000_00 },
    { kind: "devolucion" as const, amountCents: 7_500_00 },
  ];
  it("saldo: depósitos menos gastos, aplicaciones y devoluciones", () => {
    expect(fundBalance(rows)).toBe(30_000_00);
    expect(fundBalance([])).toBe(0);
  });
  it("saldo acumulado por movimiento", () => {
    expect(runningBalances(rows).map((r) => r.balanceCents)).toEqual([100_000_00, 87_500_00, 37_500_00, 30_000_00]);
  });
  it("no se puede sacar más de lo que hay", () => {
    expect(checkWithdrawal(10_00, 10_00)).toBeNull();
    expect(checkWithdrawal(10_00, 10_01)).toMatch(/no alcanza/);
    expect(checkWithdrawal(10_00, 0)).toMatch(/mayor que cero/);
    expect(checkWithdrawal(10_00, 1.5)).toMatch(/mayor que cero/);
  });
  it("no se puede borrar un depósito ya usado", () => {
    expect(checkDepositRemoval(100, 100)).toBeNull();
    expect(checkDepositRemoval(99, 100)).toMatch(/ya se usó/);
  });
  it("estado del saldo y avisos", () => {
    expect(fundsStatus(0, null, false)).toBe("sin_movimientos");
    expect(fundsStatus(0, 5_000, true)).toBe("agotado");
    expect(fundsStatus(4_000, 5_000, true)).toBe("bajo");
    expect(fundsStatus(5_000, 5_000, true)).toBe("ok");
    expect(fundsStatus(1, null, true)).toBe("ok");
  });
  it("lo aplicable a una factura no pasa del saldo ni de lo pendiente", () => {
    expect(maxApplicable(30_000, 50_000)).toBe(30_000);
    expect(maxApplicable(80_000, 50_000)).toBe(50_000);
    expect(maxApplicable(-1, 50_000)).toBe(0);
  });
});
