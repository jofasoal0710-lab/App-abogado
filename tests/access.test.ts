import { describe, expect, it } from "vitest";
import {
  activeHolderIds,
  canManageMatterAccess,
  hasClientAccess,
  hasMatterAccess,
  minimumMatterVisibility,
  usersWithoutAccess,
  type AccessUser,
} from "../src/lib/access-rules";
import { SYSTEM_ROLES } from "../src/lib/permissions";

const admin: AccessUser = { id: 1, permissions: SYSTEM_ROLES.admin.permissions };
const lucia: AccessUser = { id: 2, permissions: SYSTEM_ROLES.abogado.permissions };
const marcos: AccessUser = { id: 3, permissions: SYSTEM_ROLES.asistente.permissions };
const pablo: AccessUser = { id: 4, permissions: SYSTEM_ROLES.abogado.permissions };

const open = { visibility: "abierto" as const, responsibleId: 2 };
const restricted = { visibility: "restringido" as const, responsibleId: 2 };
const confidential = { visibility: "confidencial" as const, responsibleId: 2 };

describe("hasMatterAccess: abierto", () => {
  it("lo ve todo el mundo", () => {
    for (const u of [admin, lucia, marcos, pablo]) expect(hasMatterAccess(u, open, [])).toBe(true);
  });
});

describe("hasMatterAccess: restringido", () => {
  it("lo ven administradores, responsable y miembros", () => {
    expect(hasMatterAccess(admin, restricted, [])).toBe(true);
    expect(hasMatterAccess(lucia, restricted, [])).toBe(true);
    expect(hasMatterAccess(marcos, restricted, [3])).toBe(true);
  });
  it("…y nadie más, sea cual sea su rol", () => {
    expect(hasMatterAccess(pablo, restricted, [3])).toBe(false);
    expect(hasMatterAccess(marcos, restricted, [])).toBe(false);
    expect(hasMatterAccess(pablo, { ...restricted, responsibleId: null }, [])).toBe(false);
  });
});

describe("hasMatterAccess: confidencial (muralla china)", () => {
  it("el administrador NO lo ve si no es responsable ni miembro", () => {
    expect(hasMatterAccess(admin, confidential, [])).toBe(false);
    expect(hasMatterAccess(admin, confidential, [3])).toBe(false);
  });
  it("un administrador que es responsable o miembro sí lo ve", () => {
    expect(hasMatterAccess(admin, { ...confidential, responsibleId: 1 }, [])).toBe(true);
    expect(hasMatterAccess(admin, confidential, [1])).toBe(true);
  });
  it("responsable y miembros lo ven; el resto no", () => {
    expect(hasMatterAccess(lucia, confidential, [])).toBe(true);
    expect(hasMatterAccess(marcos, confidential, [3])).toBe(true);
    expect(hasMatterAccess(pablo, confidential, [3])).toBe(false);
  });
  it("sin responsable ni miembros no lo ve nadie (de ahí el procedimiento de emergencia)", () => {
    const orphan = { visibility: "confidencial" as const, responsibleId: null };
    for (const u of [admin, lucia, marcos, pablo]) expect(hasMatterAccess(u, orphan, [])).toBe(false);
  });
});

describe("canManageMatterAccess", () => {
  it("solo el administrador y el responsable", () => {
    expect(canManageMatterAccess(admin, restricted)).toBe(true);
    expect(canManageMatterAccess(lucia, restricted)).toBe(true);
    expect(canManageMatterAccess(pablo, restricted)).toBe(false);
    expect(canManageMatterAccess(marcos, restricted)).toBe(false);
  });
  it("un miembro no gestiona el acceso aunque pueda verlo", () => {
    expect(hasMatterAccess(marcos, restricted, [3])).toBe(true);
    expect(canManageMatterAccess(marcos, restricted)).toBe(false);
  });
});

describe("hasClientAccess", () => {
  const openClient = { visibility: "abierto" as const, createdById: 9 };
  const secretClient = { visibility: "confidencial" as const, createdById: 4 };
  it("un cliente abierto lo ve todo el mundo", () => {
    expect(hasClientAccess(pablo, openClient, false)).toBe(true);
  });
  it("uno confidencial lo ve quien lo creó o quien tiene acceso a alguno de sus expedientes", () => {
    expect(hasClientAccess(pablo, secretClient, false)).toBe(true); // lo creó
    expect(hasClientAccess(lucia, secretClient, true)).toBe(true);
    expect(hasClientAccess(lucia, secretClient, false)).toBe(false);
  });
  it("los administradores no tienen atajo en clientes confidenciales", () => {
    expect(hasClientAccess(admin, secretClient, false)).toBe(false);
    expect(hasClientAccess(admin, secretClient, true)).toBe(true);
  });
  it("un cliente confidencial sin creador conocido solo lo ven quienes tengan un expediente", () => {
    expect(hasClientAccess(pablo, { visibility: "confidencial", createdById: null }, false)).toBe(false);
  });
});

describe("minimumMatterVisibility", () => {
  it("un cliente confidencial no admite expedientes abiertos", () => {
    expect(minimumMatterVisibility({ visibility: "confidencial" }, "abierto")).toBe("restringido");
    expect(minimumMatterVisibility({ visibility: "confidencial" }, "restringido")).toBe("restringido");
    expect(minimumMatterVisibility({ visibility: "confidencial" }, "confidencial")).toBe("confidencial");
  });
  it("un cliente abierto respeta lo pedido", () => {
    expect(minimumMatterVisibility({ visibility: "abierto" }, "abierto")).toBe("abierto");
  });
});

describe("activeHolderIds", () => {
  it("cuenta responsable y miembros activos sin duplicados", () => {
    expect(activeHolderIds({ id: 2, active: true }, [{ id: 3, active: true }, { id: 2, active: true }])).toEqual([2, 3]);
  });
  it("ignora a los inactivos", () => {
    expect(activeHolderIds({ id: 2, active: false }, [{ id: 3, active: false }])).toEqual([]);
    expect(activeHolderIds(null, [{ id: 3, active: true }])).toEqual([3]);
  });
});

describe("usersWithoutAccess", () => {
  it("al restringir un expediente, quien no es responsable ni miembro lo pierde", () => {
    const lost = usersWithoutAccess(restricted, [3], [lucia, marcos, pablo]);
    expect(lost.map((u) => u.id)).toEqual([4]);
  });
  it("en un confidencial lo pierde también el administrador", () => {
    expect(usersWithoutAccess(confidential, [], [admin, lucia]).map((u) => u.id)).toEqual([1]);
  });
  it("en uno abierto nadie lo pierde", () => {
    expect(usersWithoutAccess(open, [], [admin, lucia, marcos, pablo])).toEqual([]);
  });
});
