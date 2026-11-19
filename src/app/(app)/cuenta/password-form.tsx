import { ActionForm, SubmitButton } from "@/components/form";
import { PasswordInput } from "@/components/password-input";
import { Field } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/passwords";
import { changePasswordAction } from "./actions";

/** Formulario de cambio de la propia contraseña (Mi cuenta y cambio obligatorio). */
export function PasswordForm({ next, submitLabel = "Cambiar contraseña" }: { next?: string; submitLabel?: string }) {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-4">
      {next !== undefined && <input type="hidden" name="next" value={next} />}
      <Field label="Contraseña actual">
        <PasswordInput name="currentPassword" autoComplete="current-password" required />
      </Field>
      <Field label="Nueva contraseña" hint={`Mínimo ${PASSWORD_MIN} caracteres. Una frase larga es más segura y fácil de recordar.`}>
        <PasswordInput name="newPassword" autoComplete="new-password" minLength={PASSWORD_MIN} required />
      </Field>
      <Field label="Repite la nueva contraseña">
        <PasswordInput name="confirmPassword" autoComplete="new-password" minLength={PASSWORD_MIN} required />
      </Field>
      <SubmitButton pendingText="Guardando…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
