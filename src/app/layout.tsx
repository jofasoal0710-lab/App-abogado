import type { Metadata, Viewport } from "next";
import { EB_Garamond, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { currentTheme } from "@/lib/theme-server";
import { PwaRegister } from "@/components/pwa-register";

// Tipografías alojadas por la propia app (next/font las descarga al compilar): no se pide nada a
// Google desde el navegador y la política de seguridad de contenido no cambia.
const display = EB_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Gestión del bufete", template: "%s · Gestión del bufete" },
  description: "Expedientes, clientes, agenda, documentos y facturación para despachos de abogados.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Bufete", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#1e3a8a" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // La apariencia elegida (modo, paleta y barra lateral) se aplica desde el servidor: sin parpadeo.
  const theme = await currentTheme();
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`} data-theme={theme.mode} data-palette={theme.palette} data-sidebar={theme.sidebar}>
      <body className="min-h-screen font-sans">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
