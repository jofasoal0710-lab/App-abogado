import { config } from "@/lib/config";

export const metadata = { title: "Enlace no válido" };

export default function PortalExpired() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="font-serif text-lg font-semibold">{config.firmName}</p>
      <h1 className="mt-4 font-serif text-2xl font-semibold">El enlace no es válido o ya caducó</h1>
      <p className="mt-3 text-sm text-ink-600">Por seguridad, los enlaces del portal caducan y el despacho puede revocarlos. Pide a tu abogado o abogada un enlace nuevo.</p>
    </main>
  );
}
