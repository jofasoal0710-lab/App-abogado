/** Reglas de contraseña, comunes a «Mi cuenta», al cambio obligatorio y a la pantalla «Equipo». */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

/** Problema con una contraseña nueva, o null si es válida. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `La contraseña no puede superar ${PASSWORD_MAX} caracteres.`;
  return null;
}

/** Validación del formulario de cambio: nueva válida, repetida igual y distinta de la actual. */
export function newPasswordProblem(current: string, next: string, confirm: string): string | null {
  const basic = passwordProblem(next);
  if (basic) return basic;
  if (next !== confirm) return "Las dos contraseñas nuevas no coinciden.";
  if (next === current) return "La nueva contraseña debe ser distinta de la actual.";
  return null;
}
