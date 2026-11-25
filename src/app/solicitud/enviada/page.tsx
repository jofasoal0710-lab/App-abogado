import type { Metadata } from "next";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Solicitud enviada" };

export default function IntakeSentPage() {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <p className="font-serif text-xl font-semibold">{config.firmName}</p>
          <p className="text-sm text-ink-500">Solicitud de consulta</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="card card-pad text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700" aria-hidden>
            ✓
          </div>
          <h1 className="mt-4 font-serif text-3xl font-semibold">¡Gracias! Hemos recibido tu solicitud</h1>
          <p className="mx-auto mt-3 max-w-lg text-ink-700">
            Un abogado o abogada del despacho la revisará y te contactará en los próximos días hábiles. Si tienes una fecha límite muy próxima, llámanos directamente.
          </p>
        </div>
      </main>
    </div>
  );
}
