import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { ActionForm, SubmitButton } from "@/components/form";
import { PasswordInput } from "@/components/password-input";
import { Field } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { decryptSecret } from "@/lib/mfa";
import { otpauthUri } from "@/lib/mfa-core";
import { cancelMfaSetupAction, disableMfaAction, startMfaAction } from "./mfa-actions";
import { MfaConfirm } from "./mfa-confirm";

/** Verificación en dos pasos (SEC-003) en «Mi cuenta». */
export async function MfaSection({ user }: { user: CurrentUser }) {
  const [u] = await db.select({ secret: users.mfaSecret, enabledAt: users.mfaEnabledAt, recovery: users.mfaRecoveryHashes }).from(users).where(eq(users.id, user.id));
  const secret = u?.secret && !u.enabledAt ? decryptSecret(u.secret) : null;
  const qr = secret ? await QRCode.toDataURL(otpauthUri(secret, user.email, config.firmName), { margin: 1, width: 200 }) : null;

  return (
    <section id="dos-pasos" className="card card-pad mb-6">
      <h2 className="mb-1 font-serif text-lg font-semibold">
        Verificación en dos pasos {u?.enabledAt ? <span className="badge-green ml-2 align-middle">Activada</span> : <span className="badge-amber ml-2 align-middle">Desactivada</span>}
      </h2>
      <p className="mb-4 text-sm text-ink-600">
        Además de la contraseña, al entrar se pide un código de 6 cifras de una app de autenticación del móvil (Google Authenticator, Microsoft Authenticator, Authy…). Si alguien roba tu contraseña, no podrá entrar.
      </p>
      {u?.enabledAt ? (
        <>
          <p className="mb-4 text-sm">
            Activada el {u.enabledAt.toLocaleDateString("es-CR")}. Códigos de recuperación disponibles: <strong>{u.recovery?.length ?? 0}</strong>.
          </p>
          <details>
            <summary className="cursor-pointer text-sm text-brand-700">Desactivar</summary>
            <ActionForm action={disableMfaAction} className="mt-3 grid max-w-md gap-3">
              <Field label="Contraseña">
                <PasswordInput name="password" autoComplete="current-password" required />
              </Field>
              <Field label="Código actual de la app">
                <input className="input font-mono" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={12} required />
              </Field>
              <SubmitButton className="btn-secondary">Desactivar la verificación en dos pasos</SubmitButton>
            </ActionForm>
          </details>
        </>
      ) : qr && secret ? (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Código QR para la app de autenticación" width={200} height={200} className="rounded border border-ink-200 bg-white" />
          <div>
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
              <li>Abre tu app de autenticación y escanea el código QR.</li>
              <li>
                Si no puedes escanearlo, escribe esta clave: <code className="break-all font-mono text-xs">{secret.match(/.{1,4}/g)?.join(" ")}</code>
              </li>
              <li>Escribe aquí el código de 6 cifras que aparece.</li>
            </ol>
            <MfaConfirm />
            <form action={cancelMfaSetupAction} className="mt-2">
              <button className="text-sm text-ink-500 hover:underline">Cancelar</button>
            </form>
          </div>
        </div>
      ) : (
        <form action={startMfaAction}>
          <button className="btn-primary">Activar la verificación en dos pasos</button>
        </form>
      )}
    </section>
  );
}
