/** Numeración correlativa por año: EXP-2026-0001, FAC-2026-0001… */

export function formatNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

/** Siguiente número de secuencia a partir del último número emitido en el año. */
export function nextSequence(lastNumber: string | null | undefined, prefix: string, year: number): number {
  if (!lastNumber) return 1;
  const m = lastNumber.match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
  return m ? Number(m[1]) + 1 : 1;
}
