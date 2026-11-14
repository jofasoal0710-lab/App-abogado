import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { entries, roleLabels } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { createUserAction, updateUserAction } from "./actions";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage() {
  await requireAdmin();
  const all = await db.select().from(users).orderBy(asc(users.name));

  return (
    <>
      <PageHeader title="Equipo" subtitle="Usuarios con acceso al sistema" />

      <section className="card mb-8">
        <ul className="divide-y divide-ink-100">
          {all.map((u) => (
            <li key={u.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                  <div>
                    <p className="font-medium text-ink-900">
                      {u.name} {!u.active && <span className="badge-gray ml-1">Inactivo</span>}
                    </p>
                    <p className="text-xs text-ink-500">{u.email}</p>
                  </div>
                  <div className="text-right text-sm text-ink-600">
                    <p>
                      {roleLabels[u.role]}
                      {!u.emailReminders && <span className="badge-gray ml-2">Sin avisos</span>}
                    </p>
                    <p className="text-xs">{formatMoney(u.hourlyRateCents)}/h</p>
                  </div>
                </summary>
                <div className="border-t border-ink-100 bg-ink-50/50 px-5 py-4">
                  <UserForm action={updateUserAction.bind(null, u.id)} user={u} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mb-3 font-serif text-lg font-semibold">Añadir usuario</h2>
      <div className="card card-pad">
        <UserForm action={createUserAction} />
      </div>
    </>
  );
}

function UserForm({
  action,
  user,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  user?: User;
}) {
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
          <select className="input" name="role" defaultValue={user?.role ?? "abogado"}>
            {entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tarifa por hora (€)">
          <input
            className="input"
            name="hourlyRate"
            inputMode="decimal"
            defaultValue={user ? (user.hourlyRateCents / 100).toFixed(2).replace(".", ",") : ""}
          />
        </Field>
        <Field label={user ? "Nueva contraseña (opcional)" : "Contraseña"} hint="Mínimo 10 caracteres">
          <input className="input" type="password" name="password" autoComplete="new-password" required={!user} />
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
