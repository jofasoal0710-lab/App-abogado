import type { Metadata } from "next";
import { config } from "@/lib/config";
import { todayISO } from "@/lib/dates";
import { getIntakeSettings } from "@/lib/intake-db";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "Solicitar una consulta" };
export const dynamic = "force-dynamic";

/** Formulario público para posibles clientes (sin sesión). Solo funciona si el despacho lo ha activado. */
export default async function IntakePage() {
  const settings = await getIntakeSettings();
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <p className="font-serif text-xl font-semibold">{config.firmName}</p>
          <p className="text-sm text-ink-500">Solicitud de consulta</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {settings.enabled ? (
          <>
            <h1 className="font-serif text-3xl font-semibold">Cuéntanos tu caso</h1>
            <p className="mt-2 whitespace-pre-line text-ink-700">
              {settings.intro?.trim() || "Rellena este formulario y un abogado o abogada del despacho revisará tu consulta y te contactará. Solo te llevará unos minutos."}
            </p>
            <div className="mt-6">
              <IntakeForm firmName={config.firmName} today={todayISO()} />
            </div>
          </>
        ) : (
          <div className="card card-pad">
            <h1 className="font-serif text-2xl font-semibold">Formulario no disponible</h1>
            <p className="mt-2 text-ink-700">En este momento no recibimos solicitudes por internet. Contacta al despacho por teléfono o correo electrónico.</p>
          </div>
        )}
      </main>
    </div>
  );
}
