import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { safeNext } from "@/lib/safe-redirect";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Quien ya tiene sesión no necesita ver el login.
  if (await getCurrentUser()) redirect(safeNext(next));
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-serif text-3xl font-semibold text-ink-900">{config.firmName}</p>
          <p className="mt-1 text-sm text-ink-500">Acceso al sistema de gestión</p>
        </div>
        <div className="card card-pad">
          <ActionForm action={loginAction} className="space-y-4">
            <input type="hidden" name="next" value={next ?? ""} />
            <Field label="Correo electrónico">
              <input className="input" type="email" name="email" autoComplete="username" required autoFocus />
            </Field>
            <Field label="Contraseña">
              <input className="input" type="password" name="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton className="btn-primary w-full" pendingText="Entrando…">
              Entrar
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
