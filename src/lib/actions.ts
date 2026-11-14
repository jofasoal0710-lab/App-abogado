export type ActionState = { error?: string; ok?: string } | undefined;

/** Primer mensaje de error de un resultado de zod, en español legible. */
export function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Datos no válidos";
}

export function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}

export function intOrNull(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (!/^\d+$/.test(v)) return null;
  return Number(v);
}
