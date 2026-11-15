import { describe, expect, it } from "vitest";
import { canManageMatterAccess, hasMatterAccess, type AccessUser } from "../src/lib/access-rules";

const admin: AccessUser = { id: 1, role: "admin" };
const lucia: AccessUser = { id: 2, role: "abogado" };
const marcos: AccessUser = { id: 3, role: "asistente" };
const pablo: AccessUser = { id: 4, role: "abogado" };

const open = { visibility: "abierto" as const, responsibleId: 2 };
const closed = { visibility: "restringido" as const, responsibleId: 2 };

describe("hasMatterAccess", () => {
  it("un expediente abierto lo ve todo el mundo", () => {
    for (const u of [admin, lucia, marcos, pablo]) expect(hasMatterAccess(u, open, [])).toBe(true);
  });
  it("uno restringido lo ven el administrador, el responsable y los miembros", () => {
    expect(hasMatterAccess(admin, closed, [])).toBe(true);
    expect(hasMatterAccess(lucia, closed, [])).toBe(true); // responsable
    expect(hasMatterAccess(marcos, closed, [3])).toBe(true); // miembro
  });
  it("…y nadie más, sea cual sea su rol", () => {
    expect(hasMatterAccess(pablo, closed, [3])).toBe(false);
    expect(hasMatterAccess(marcos, closed, [])).toBe(false);
    expect(hasMatterAccess(pablo, { ...closed, responsibleId: null }, [])).toBe(false);
  });
  it("un expediente restringido sin responsable solo lo ven administradores y miembros", () => {
    const orphan = { visibility: "restringido" as const, responsibleId: null };
    expect(hasMatterAccess(lucia, orphan, [])).toBe(false);
    expect(hasMatterAccess(lucia, orphan, [2])).toBe(true);
    expect(hasMatterAccess(admin, orphan, [])).toBe(true);
  });
  it("ser abogado no da acceso por sí solo", () => {
    expect(hasMatterAccess(pablo, closed, [])).toBe(false);
  });
});

describe("canManageMatterAccess", () => {
  it("solo el administrador y el responsable", () => {
    expect(canManageMatterAccess(admin, closed)).toBe(true);
    expect(canManageMatterAccess(lucia, closed)).toBe(true);
    expect(canManageMatterAccess(pablo, closed)).toBe(false);
    expect(canManageMatterAccess(marcos, closed)).toBe(false);
  });
  it("un miembro no gestiona el acceso aunque pueda verlo", () => {
    expect(hasMatterAccess(marcos, closed, [3])).toBe(true);
    expect(canManageMatterAccess(marcos, closed)).toBe(false);
  });
  it("sin responsable solo gestionan los administradores", () => {
    expect(canManageMatterAccess(lucia, { responsibleId: null })).toBe(false);
    expect(canManageMatterAccess(admin, { responsibleId: null })).toBe(true);
  });
});
