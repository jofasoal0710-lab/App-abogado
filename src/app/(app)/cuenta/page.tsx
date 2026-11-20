import type { Metadata } from "next";
import { appLocale } from "@/lib/locale";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { hashSessionId, readSessionCookie } from "@/lib/session";
import { closeOtherSessionsAction } from "./actions";
import { PasswordForm } from "./password-form";
import { AppearanceForm } from "./appearance-form";
import { currentTheme } from "@/lib/theme-server";

export const metadata: Metadata = { title: "Mi cuenta" };

const when = (d: Date | null) => (d ? d.toLocaleString(appLocale(), { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Resumen legible del navegador a partir del User-Agent. */
function browserOf(ua: string | null): string {
  if (!ua) return "Navegador desconocido";
  const b = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} en ${os}` : b;
}

export default async function AccountPage() {
  const user = await requireUser();
  const [me] = await db.select({ passwordChangedAt: users.passwordChangedAt }).from(users).where(eq(users.id, user.id));
  const currentHash = hashSessionId((await readSessionCookie())?.sid ?? "");
  const open = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, sql`now()`)))
    .orderBy(desc(sessions.createdAt));
  const others = open.filter((s) => s.tokenHash !== currentHash).length;

  return (
    <>
      <PageHeader title="Mi cuenta" subtitle={`${user.name} · ${user.email} · ${user.roleName}`} />

      <section id="apariencia" className="card card-pad mb-6">
        <h2 className="mb-1 font-serif text-lg font-semibold">Apariencia</h2>
        <p className="mb-4 text-sm text-ink-600">Elige el modo claro u oscuro, la paleta de colores y cómo se ve el menú. Solo cambia para ti.</p>
        <AppearanceForm current={await currentTheme()} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-1 font-serif text-lg font-semibold">Cambiar contraseña</h2>
          <p className="mb-4 text-sm text-ink-600">
            Último cambio: {when(me?.passwordChangedAt ?? null)}. Al cambiarla se cierran tus sesiones en otros dispositivos y te
            avisamos por correo.
          </p>
          <PasswordForm />
        </section>

        <section className="card card-pad">
          <h2 className="mb-1 font-serif text-lg font-semibold">Sesiones abiertas</h2>
          <p className="mb-4 text-sm text-ink-600">
            Cada sesión dura como máximo 12 horas. Si ves una que no reconoces, ciérralas y cambia tu contraseña.
          </p>
          <ul className="mb-4 divide-y divide-ink-100 text-sm">
            {open.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {browserOf(s.userAgent)}
                  {s.tokenHash === currentHash && <span className="badge-green ml-2">Esta sesión</span>}
                  <span className="block text-xs text-ink-500">IP {s.ip ?? "desconocida"}</span>
                </span>
                <span className="text-right text-xs text-ink-500">
                  Desde {when(s.createdAt)}
                  <span className="block">Caduca {when(s.expiresAt)}</span>
                </span>
              </li>
            ))}
          </ul>
          {others > 0 && (
            <ActionForm action={closeOtherSessionsAction}>
              <SubmitButton className="btn-secondary">Cerrar las otras {others} sesión(es)</SubmitButton>
            </ActionForm>
          )}
        </section>
      </div>
    </>
  );
}
