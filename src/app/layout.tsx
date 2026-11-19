import type { Metadata } from "next";
import { EB_Garamond, Source_Sans_3 } from "next/font/google";
import "./globals.css";

// Tipografías alojadas por la propia app (next/font las descarga al compilar): no se pide nada a
// Google desde el navegador y la política de seguridad de contenido no cambia.
const display = EB_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Gestión del bufete", template: "%s · Gestión del bufete" },
  description: "Expedientes, clientes, agenda, documentos y facturación para despachos de abogados.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
