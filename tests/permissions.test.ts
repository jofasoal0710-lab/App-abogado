import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, can, normalizePermissions, permissionGroups, SYSTEM_ROLES } from "../src/lib/permissions";

describe("permisos", () => {
  it("normaliza: ignora desconocidos, quita duplicados y añade lo implícito", () => {
    expect(normalizePermissions(["facturacion.emitir", "inventado", "facturacion.emitir"])).toEqual(["facturacion.ver", "facturacion.emitir"]);
    expect(normalizePermissions(["clientes.gestionar_todos"])).toEqual(["clientes.gestionar", "clientes.gestionar_todos"]);
    expect(normalizePermissions([])).toEqual([]);
  });

  it("el administrador lo tiene todo", () => {
    expect(SYSTEM_ROLES.admin.permissions).toEqual(ALL_PERMISSIONS);
  });

  it("abogado y asistente conservan exactamente lo que podían hacer con los roles fijos", () => {
    const abogado = { permissions: SYSTEM_ROLES.abogado.permissions };
    const asistente = { permissions: SYSTEM_ROLES.asistente.permissions };
    for (const p of ["facturacion.ver", "facturacion.cobros", "facturacion.emitir", "facturacion.exportar", "clientes.gestionar", "documentos.borrar"] as const) {
      expect(can(abogado, p)).toBe(true);
    }
    for (const p of ["expedientes.ver_restringidos", "expedientes.gestionar_acceso", "expedientes.borrar", "equipo.gestionar", "seguridad.ver", "recordatorios.gestionar", "clientes.gestionar_todos", "notas.borrar_todas", "horas.borrar_todas"] as const) {
      expect(can(abogado, p)).toBe(false);
    }
    expect(asistente.permissions).toEqual(["facturacion.ver", "facturacion.cobros"]);
  });

  it("agrupa todos los permisos para el formulario, sin perder ninguno", () => {
    const keys = permissionGroups().flatMap((g) => g.items.map((i) => i.key));
    expect(keys.sort()).toEqual([...ALL_PERMISSIONS].sort());
  });
});
