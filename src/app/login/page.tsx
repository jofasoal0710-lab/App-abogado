import type { Metadata } from "next";
import { PasswordInput } from "@/components/password-input";
import { Icon } from "@/components/icons";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { safeNext } from "@/lib/safe-redirect";
import { headers } from "next/headers";
import { Turnstile } from "@/components/turnstile";
import { turnstileSiteKey } from "@/lib/turnstile-core";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Quien ya tiene sesión no necesita ver el login (y si debe cambiar la contraseña, va a hacerlo).
  const user = await getSessionUser();
  if (user?.mustChangePassword) redirect("/cambiar-contrasena");
  if (user) redirect(safeNext(next));
  const siteKey = turnstileSiteKey();
  const nonce = siteKey ? ((await headers()).get("x-nonce") ?? undefined) : undefined;
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-700 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-700">
            <Icon name="balanza" className="h-6 w-6" />
          </span>
          <p className="font-serif text-3xl font-semibold text-white">{config.firmName}</p>
          <p className="mt-1 text-sm text-white/80">Acceso al sistema de gestión</p>
        </div>
        <div className="card card-pad shadow-xl shadow-brand-900/30">
          <ActionForm action={loginAction} className="space-y-4">
            <input type="hidden" name="next" value={next ?? ""} />
            <Field label="Correo electrónico">
              <input className="input" type="email" name="email" autoComplete="username" required autoFocus />
            </Field>
            <Field label="Contraseña">
              <PasswordInput name="password" autoComplete="current-password" required />
            </Field>
            {siteKey && <Turnstile siteKey={siteKey} action="login" nonce={nonce} />}
            <SubmitButton className="btn-primary w-full" pendingText="Entrando…">
              Entrar
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
