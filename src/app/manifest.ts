import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

/** App instalable (Android, iPhone, escritorio): icono en la pantalla de inicio y ventana propia. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${config.firmName} · Gestión del bufete`,
    short_name: config.firmName.slice(0, 12) || "Bufete",
    description: "Expedientes, plazos, horas y facturación del despacho.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#1e3a8a",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Control de plazos", url: "/agenda" },
      { name: "Registrar horas", url: "/horas" },
    ],
  };
}
