/**
 * Permisos de los roles. Cada rol (tabla `roles`) guarda la lista de permisos que concede; el
 * administrador del sistema los tiene todos y no se puede editar, para que nunca se pierda el control.
 *
 * Lo que NO depende de permisos (y ningún rol puede saltarse):
 * - Expedientes y clientes confidenciales: solo los ven su responsable y sus miembros.
 * - Expedientes restringidos: su responsable y miembros, más quien tenga «ver restringidos».
 * - Cada persona cambia su propia contraseña y ve sus sesiones.
 */
export const PERMISSIONS = {
  "expedientes.ver_restringidos": {
    group: "Expedientes",
    label: "Ver todos los expedientes restringidos",
    hint: "Sin este permiso, solo los restringidos de los que es responsable o miembro. Los confidenciales nunca.",
  },
  "expedientes.gestionar_acceso": {
    group: "Expedientes",
    label: "Gestionar el acceso de cualquier expediente",
    hint: "Visibilidad, responsable y miembros. Sin este permiso, solo en los expedientes de los que es responsable.",
  },
  "expedientes.borrar": { group: "Expedientes", label: "Eliminar expedientes", hint: "Con todas sus notas, horas, eventos y documentos." },
  "notas.borrar_todas": { group: "Expedientes", label: "Borrar notas de otras personas", hint: "Cada persona puede borrar siempre las suyas." },
  "clientes.gestionar": {
    group: "Clientes",
    label: "Gestionar clientes",
    hint: "Dar de alta clientes confidenciales, eliminar clientes y cambiar la confidencialidad de los que dio de alta.",
  },
  "clientes.gestionar_todos": {
    group: "Clientes",
    label: "Cambiar la confidencialidad de cualquier cliente",
    hint: "No solo de los que dio de alta. Incluye «Gestionar clientes».",
  },
  "documentos.borrar": { group: "Documentos y horas", label: "Eliminar documentos" },
  "plantillas.gestionar": {
    group: "Documentos y horas",
    label: "Gestionar las plantillas Word del despacho",
    hint: "Subir, sustituir y eliminar plantillas. Usarlas para generar documentos puede cualquiera.",
  },
  "horas.borrar_todas": { group: "Documentos y horas", label: "Corregir y borrar horas de otras personas", hint: "Solo horas sin facturar. Cada persona puede corregir y borrar siempre las suyas." },
  "facturacion.ver": { group: "Facturación", label: "Ver facturas y cobros", hint: "Sección Facturas, importes pendientes y cobros del panel." },
  "facturacion.cobros": { group: "Facturación", label: "Registrar cobros", hint: "Incluye «Ver facturas y cobros»." },
  "facturacion.emitir": {
    group: "Facturación",
    label: "Emitir facturas",
    hint: "Emitir, crear rectificativas y borrar cobros. Incluye «Ver facturas y cobros».",
  },
  "facturacion.exportar": { group: "Facturación", label: "Exportar el libro de facturas (CSV)", hint: "Incluye «Ver facturas y cobros»." },
  "notaria.usar": {
    group: "Notariado",
    label: "Usar el gestor notarial",
    hint: "Su propio protocolo, índice, testimonios y perfil de notario. Nadie ve el protocolo de otro notario.",
  },
  "equipo.gestionar": {
    group: "Administración",
    label: "Gestionar el equipo y los roles",
    hint: "Dar de alta y desactivar usuarios, asignar roles, restablecer contraseñas y cerrar sesiones. Ojo: quien lo tiene puede darse cualquier otro permiso.",
  },
  "reportes.ver": {
    group: "Administración",
    label: "Ver reportes y estadísticas del despacho",
    hint: "Horas de todo el equipo, facturación, cobros, cartera pendiente y rentabilidad (solo de los expedientes a los que tiene acceso). Incluye «Ver facturas y cobros».",
  },
  "seguridad.ver": { group: "Administración", label: "Ver el registro de seguridad" },
  "recordatorios.gestionar": { group: "Administración", label: "Gestionar los recordatorios por correo" },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(p: string): p is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, p);
}

/** Permisos que otro implica: para emitir o exportar hay que poder ver las facturas, etc. */
const IMPLIES: Partial<Record<Permission, Permission[]>> = {
  "facturacion.cobros": ["facturacion.ver"],
  "facturacion.emitir": ["facturacion.ver"],
  "facturacion.exportar": ["facturacion.ver"],
  "reportes.ver": ["facturacion.ver"],
  "clientes.gestionar_todos": ["clientes.gestionar"],
};

/** Limpia una lista recibida (formulario o base de datos): solo permisos conocidos, sin duplicados y con sus implicaciones. */
export function normalizePermissions(list: readonly string[]): Permission[] {
  const out = new Set<Permission>();
  for (const p of list) {
    if (!isPermission(p)) continue;
    out.add(p);
    for (const q of IMPLIES[p] ?? []) out.add(q);
  }
  return ALL_PERMISSIONS.filter((p) => out.has(p));
}

/** Roles con los que nace la aplicación (mismos permisos que tenían los tres roles fijos anteriores). */
export const SYSTEM_ROLES = {
  admin: { name: "Administrador", description: "Acceso completo. No se puede modificar ni eliminar.", permissions: ALL_PERMISSIONS },
  abogado: {
    name: "Abogado/a",
    description: "Lleva expedientes y factura.",
    permissions: normalizePermissions(["clientes.gestionar", "documentos.borrar", "plantillas.gestionar", "facturacion.cobros", "facturacion.emitir", "facturacion.exportar", "notaria.usar"]),
  },
  asistente: {
    name: "Asistente",
    description: "Apoyo administrativo: registra cobros pero no emite facturas ni borra.",
    permissions: normalizePermissions(["facturacion.cobros"]),
  },
} as const;

export type SystemRoleKey = keyof typeof SYSTEM_ROLES;

/**
 * Permisos efectivos de un rol. El administrador del sistema tiene siempre TODOS, también los que se
 * añadan en el futuro; los demás, los que tengan guardados (limpios y con sus implicaciones).
 */
export function effectivePermissions(role: { systemKey: string | null; permissions: readonly string[] }): Permission[] {
  return role.systemKey === "admin" ? [...ALL_PERMISSIONS] : normalizePermissions(role.permissions);
}

/** Lo mínimo que necesita cualquier comprobación de permisos. */
export type PermissionHolder = { permissions: readonly string[] };

export function can(user: PermissionHolder, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/** Permisos agrupados para pintar las casillas del formulario de roles. */
export function permissionGroups(): { group: string; items: { key: Permission; label: string; hint?: string }[] }[] {
  const groups = new Map<string, { key: Permission; label: string; hint?: string }[]>();
  for (const key of ALL_PERMISSIONS) {
    const def = PERMISSIONS[key] as { group: string; label: string; hint?: string };
    groups.set(def.group, [...(groups.get(def.group) ?? []), { key, label: def.label, hint: def.hint }]);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}
