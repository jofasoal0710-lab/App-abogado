/** Tipos de evento del registro de seguridad y su descripción en pantalla (sin dependencias de servidor). */
export const SECURITY_EVENT_LABELS = {
  login_ok: "Inicio de sesión",
  login_fallido: "Inicio de sesión fallido",
  login_bloqueado: "Inicio de sesión bloqueado por demasiados intentos",
  logout: "Cierre de sesión",
  contrasena_cambiada: "Contraseña cambiada por su titular",
  contrasena_actual_incorrecta: "Contraseña actual incorrecta al intentar cambiarla",
  contrasena_restablecida: "Contraseña restablecida por un administrador",
  usuario_creado: "Cuenta creada",
  rol_cambiado: "Rol cambiado",
  correo_cambiado: "Correo de la cuenta cambiado",
  usuario_desactivado: "Cuenta desactivada",
  usuario_reactivado: "Cuenta reactivada",
  sesiones_cerradas: "Sesiones cerradas",
  rol_creado: "Rol creado",
  rol_modificado: "Permisos de un rol modificados",
  rol_eliminado: "Rol eliminado",
} as const;

export type SecurityEventKind = keyof typeof SECURITY_EVENT_LABELS;

/** Eventos que conviene que un administrador revise con atención. */
export const NOTABLE_EVENTS: ReadonlySet<SecurityEventKind> = new Set([
  "login_bloqueado",
  "contrasena_actual_incorrecta",
  "contrasena_restablecida",
  "rol_cambiado",
  "correo_cambiado",
  "usuario_desactivado",
  "rol_modificado",
  "rol_eliminado",
]);
