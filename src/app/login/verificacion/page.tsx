import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { Icon } from "@/components/icons";
import { Field } from "@/components/ui";
import { config } from "@/lib/config";
import { readPendingLogin } from "@/lib/mfa";
import { verifySecondFactorAction } from "../actions";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default async function SecondFactorPage() {
  if (!(await readPendingLogin())) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-700 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-700">
            <Icon name="balanza" className="h-6 w-6" />
          </span>
          <p className="font-serif text-3xl font-semibold text-white">{config.firmName}</p>
          <p className="mt-1 text-sm text-white/80">Verificación en dos pasos</p>
        </div>
        <div className="card card-pad shadow-xl shadow-brand-900/30">
          <ActionForm action={verifySecondFactorAction} className="space-y-4">
            <Field label="Código de 6 cifras" hint="Ábrelo en tu app de autenticación. Si perdiste el móvil, escribe uno de tus códigos de recuperación.">
              <input className="input text-center font-mono text-lg tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={12} required autoFocus />
            </Field>
            <SubmitButton className="btn-primary w-full" pendingText="Comprobando…">
              Verificar y entrar
            </SubmitButton>
          </ActionForm>
          <p className="mt-4 text-center text-sm">
            <Link href="/login" className="text-brand-700 hover:underline">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
