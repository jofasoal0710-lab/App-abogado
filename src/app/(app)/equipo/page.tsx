import { resetMfaAction } from "../cuenta/mfa-actions";
import type { Metadata } from "next";
import { PasswordInput } from "@/components/password-input";
import Link from "next/link";
import { asc, count, gt, sql } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { listOrphanConfidentialMatters } from "@/lib/access";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { claimOrphanMatterAction } from "../expedientes/access-actions";
import { permissionGroups } from "@/lib/permissions";
import { listRolesWithCounts } from "@/lib/roles";
import { createUserAction, revokeUserSessionsAction, updateUserAction } from "./actions";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "./role-actions";

type RoleRow = Awaited<ReturnType<typeof listRolesWithCounts>>[number];

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  await requirePermission("equipo.gestionar");
  const vista = (await searchParams).vista === "roles" ? "roles" : "personas";
  const roleList = await listRolesWithCounts();
  const roleName = new Map(roleList.map((r) => [r.id, r.name]));
  const all = await db.select().from(users).orderBy(asc(users.name));
  const orphans = await listOrphanConfidentialMatters();
  const openSessions = new Map(
    (
      await db
        .select({ userId: sessions.userId, n: count() })
        .from(sessions)
        .where(gt(sessions.expiresAt, sql`now()`))
        .groupBy(sessions.userId)
    ).map((r) => [r.userId, r.n]),
  );

  return (
    <>
      <PageHeader title="Equipo" subtitle="Personas con acceso al sistema y lo que puede hacer cada rol" />

      <nav className="no-print mb-6 flex gap-1 border-b border-ink-200" aria-label="Secciones del equipo">
        {[
          ["personas", "Personas", "/equipo"],
          ["roles", "Roles y permisos", "/equipo?vista=roles"],
        ].map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            aria-current={vista === key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              vista === key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {vista === "roles" ? (
        <RolesView roles={roleList} />
      ) : (
      <>

      {orphans.length > 0 && (
        <section className="mb-8 overflow-hidden rounded-lg border border-red-200 bg-red-50/50">
          <h2 className="border-b border-red-200 px-5 py-3 font-serif text-lg font-semibold text-red-800">
            Expedientes confidenciales sin ninguna persona activa con acceso ({orphans.length})
          </h2>
          <p className="px-5 pt-3 text-sm text-ink-700">
            Nadie puede ver ni gestionar estos expedientes (su responsable y miembros están inactivos o no existen). Como administrador puedes reclamar el acceso; el motivo
            queda registrado en el historial del expediente. Solo se ofrece cuando de verdad están huérfanos.
          </p>
          <ul className="divide-y divide-red-100">
            {orphans.map((o) => (
              <li key={o.id} className="px-5 py-3">
                <p className="text-sm font-medium text-ink-900">
                  {o.number} · {o.title}
                </p>
                <ActionForm action={claimOrphanMatterAction.bind(null, o.id)}>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <Field label="Motivo (obligatorio, quedará registrado)" className="min-w-72 flex-1">
                      <input className="input" name="reason" required minLength={10} maxLength={500} />
                    </Field>
                    <SubmitButton className="btn-danger">Reclamar acceso</SubmitButton>
                  </div>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mb-8">
        <ul className="divide-y divide-ink-100">
          {all.map((u) => (
            <li key={u.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                  <div>
                    <p className="font-medium text-ink-900">
                      {u.name} {!u.active && <span className="badge-gray ml-1">Inactivo</span>}
                      {u.active && u.mustChangePassword && <span className="badge-amber ml-1">Debe elegir su contraseña</span>}
                      {u.mfaEnabledAt ? <span className="badge-green ml-1">Dos pasos</span> : u.active && <span className="badge-gray ml-1">Sin verificación en dos pasos</span>}
                    </p>
                    <p className="text-xs text-ink-500">{u.email}</p>
                  </div>
                  <div className="text-right text-sm text-ink-600">
                    <p>
                      {roleName.get(u.roleId)}
                      {!u.emailReminders && <span className="badge-gray ml-2">Sin avisos</span>}
                    </p>
                    <p className="text-xs">{formatMoney(u.hourlyRateCents)}/h</p>
                  </div>
                </summary>
                <div className="border-t border-ink-100 bg-ink-50/50 px-5 py-4">
                  <UserForm action={updateUserAction.bind(null, u.id)} user={u} roles={roleList} />
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3 text-sm text-ink-600">
                    <span>Sesiones abiertas: {openSessions.get(u.id) ?? 0}</span>
                    {u.mfaEnabledAt && (
                      <form action={resetMfaAction.bind(null, u.id)}>
                        <button className="btn-secondary btn-sm">Quitar su verificación en dos pasos (perdió el móvil)</button>
                      </form>
                    )}
                    {(openSessions.get(u.id) ?? 0) > 0 && (
                      <ActionForm action={revokeUserSessionsAction.bind(null, u.id)}>
                        <SubmitButton className="btn-secondary btn-sm">Cerrar sus sesiones</SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mb-3 font-serif text-lg font-semibold">Añadir usuario</h2>
      <div className="card card-pad">
        <UserForm action={createUserAction} roles={roleList} />
      </div>
      </>
      )}
    </>
  );
}

/** Roles: el de Administrador se muestra bloqueado; el resto se edita con casillas. */
function RolesView({ roles }: { roles: RoleRow[] }) {
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-ink-600">
        Cada persona tiene un rol, y el rol decide lo que puede hacer. Los cambios se aplican al momento a todas las personas con ese rol. Ningún rol da acceso a los
        expedientes y clientes <strong>confidenciales</strong>: esos solo los ven su responsable y sus miembros.
      </p>
      <section className="card mb-8">
        <ul className="divide-y divide-ink-100">
          {roles.map((r) => (
            <li key={r.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">
                      {r.name}
                      {r.systemKey === "admin" && <span className="badge-blue ml-2">Acceso completo</span>}
                    </p>
                    {r.description && <p className="text-xs text-ink-500">{r.description}</p>}
                  </div>
                  <div className="shrink-0 text-right text-sm text-ink-600">
                    <p>
                      {r.users} {r.users === 1 ? "persona" : "personas"}
                    </p>
                    <p className="text-xs">
                      {r.permissions.length} {r.permissions.length === 1 ? "permiso" : "permisos"}
                    </p>
                  </div>
                </summary>
                <div className="border-t border-ink-100 bg-ink-50/50 px-5 py-4">
                  {r.systemKey === "admin" ? (
                    <PermissionList checked={r.permissions} disabled />
                  ) : (
                    <>
                      <RoleForm action={updateRoleAction.bind(null, r.id)} role={r} />
                      {!r.systemKey && (
                        <div className="mt-4 border-t border-ink-100 pt-3">
                          {r.users === 0 ? (
                            <ActionForm action={deleteRoleAction.bind(null, r.id)}>
                              <SubmitButton className="btn-danger btn-sm">Eliminar rol</SubmitButton>
                            </ActionForm>
                          ) : (
                            <p className="text-xs text-ink-500">Para eliminar este rol, cambia antes el rol de las personas que lo tienen.</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mb-3 font-serif text-lg font-semibold">Crear un rol</h2>
      <div className="card card-pad">
        <RoleForm action={createRoleAction} />
      </div>
    </>
  );
}

function RoleForm({ action, role }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; role?: RoleRow }) {
  return (
    <ActionForm action={action} resetOnSuccess={!role}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nombre del rol">
          <input className="input" name="name" defaultValue={role?.name} required minLength={2} maxLength={60} placeholder="Por ejemplo: Socio, Contable, Becario" />
        </Field>
        <Field label="Descripción (opcional)" className="sm:col-span-2">
          <input className="input" name="description" defaultValue={role?.description ?? ""} maxLength={200} />
        </Field>
      </div>
      <div className="mt-4">
        <PermissionList checked={role?.permissions ?? []} />
      </div>
      <div className="mt-4">
        <SubmitButton>{role ? "Guardar rol" : "Crear rol"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function PermissionList({ checked, disabled = false }: { checked: readonly string[]; disabled?: boolean }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {permissionGroups().map((g) => (
        <fieldset key={g.group} disabled={disabled}>
          <legend className="mb-2 text-sm font-semibold text-ink-800">{g.group}</legend>
          <div className="space-y-2">
            {g.items.map((p) => (
              <label key={p.key} className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" name="permissions" value={p.key} defaultChecked={checked.includes(p.key)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
                <span>
                  <span className="text-ink-800">{p.label}</span>
                  {p.hint && <span className="block text-xs text-ink-500">{p.hint}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function UserForm({
  action,
  user,
  roles,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  user?: User;
  roles: RoleRow[];
}) {
  const defaultRole = user?.roleId ?? roles.find((r) => r.systemKey === "abogado")?.id;
  return (
    <ActionForm action={action} resetOnSuccess={!user}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nombre">
          <input className="input" name="name" defaultValue={user?.name} required />
        </Field>
        <Field label="Correo electrónico">
          <input className="input" type="email" name="email" defaultValue={user?.email} required autoComplete="off" />
        </Field>
        <Field label="Rol">
          <select className="input" name="roleId" defaultValue={defaultRole}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Carné del Colegio de Abogados" hint="Sale en la firma de los escritos.">
          <input className="input" name="barNumber" defaultValue={user?.barNumber ?? ""} maxLength={40} />
        </Field>
        <Field label="Tarifa por hora">
          <input
            className="input"
            name="hourlyRate"
            inputMode="decimal"
            defaultValue={user ? (user.hourlyRateCents / 100).toFixed(2).replace(".", ",") : ""}
          />
        </Field>
        <Field
          label={user ? "Restablecer contraseña (opcional)" : "Contraseña provisional"}
          hint={
            user
              ? "Provisional: deberá cambiarla al entrar, se cerrarán sus sesiones y se le avisará por correo. Mínimo 10 caracteres."
              : "Deberá cambiarla por una suya al entrar por primera vez. Mínimo 10 caracteres."
          }
        >
          <PasswordInput name="password" autoComplete="new-password" required={!user} />
        </Field>
        <div className="space-y-2 self-end pb-2 text-sm text-ink-700">
          {user && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={user.active} />
              Usuario activo
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" name="emailReminders" defaultChecked={user?.emailReminders ?? true} />
            Recibe recordatorios por correo
          </label>
        </div>
      </div>
      <div className="mt-3">
        <SubmitButton>{user ? "Guardar cambios" : "Crear usuario"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
