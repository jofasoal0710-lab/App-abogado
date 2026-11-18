import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { safeNext } from "@/lib/safe-redirect";
import { PasswordForm } from "../(app)/cuenta/password-form";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: "Elige tu contraseña" };

/**
 * Cambio obligatorio de contraseña (primer acceso o tras un restablecimiento por un administrador).
 * Fuera del área de la aplicación a propósito: hasta completar el cambio no se puede usar nada más.
 */
export default async function ForcedPasswordChangePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/cuenta");
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="font-serif text-3xl font-semibold text-ink-900">{config.firmName}</p>
          <p className="mt-1 text-sm text-ink-500">Elige tu contraseña</p>
        </div>
        <div className="card card-pad">
          <p className="mb-4 text-sm text-ink-700">
            Hola {user.name}. Antes de continuar tienes que elegir una contraseña que solo conozcas tú: la que tienes ahora es
            provisional (te la dio un administrador o se configuró al instalar la aplicación). Escríbela en «Contraseña actual».
          </p>
          <PasswordForm next={safeNext(next)} submitLabel="Guardar y entrar" />
        </div>
        <form action={logoutAction} className="mt-4 text-center">
          <button className="text-sm text-ink-500 hover:text-ink-800">Salir sin cambiarla</button>
        </form>
      </div>
    </main>
  );
}
