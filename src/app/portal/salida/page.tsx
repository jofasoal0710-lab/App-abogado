import { config } from "@/lib/config";

export const metadata = { title: "Sesión cerrada" };

export default function PortalBye() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="font-serif text-lg font-semibold">{config.firmName}</p>
      <h1 className="mt-4 font-serif text-2xl font-semibold">Has salido del portal</h1>
      <p className="mt-3 text-sm text-ink-600">Para volver a entrar, abre de nuevo el enlace que te envió el despacho.</p>
    </main>
  );
}
