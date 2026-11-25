import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los documentos se suben mediante Server Actions: límite justo por encima de los 25 MB permitidos (el
  // cuerpo se lee antes de comprobar la sesión, así que no conviene dejar margen de más; SEC-014).
  experimental: {
    serverActions: { bodySizeLimit: "26mb" },
  },
  serverExternalPackages: ["pg", "@dojocoding/hacienda-sdk", "nspell", "dictionary-es", "mammoth"],
  // No anunciar el framework en cada respuesta (X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Todo salvo los visores (PDF e imágenes que se muestran dentro de la propia app, en un marco).
        source: "/((?!api/(?:documentos|escritos)/\\d+/ver).*)",
        headers: [
          // HSTS: el navegador solo usará HTTPS con este dominio durante 2 años, también en la primera
          // petición de las visitas siguientes (evita que en una red hostil se intercepte el login por HTTP).
          // Los navegadores la ignoran si llega por HTTP (desarrollo local). Sin «preload»: eso es una
          // decisión del dominio propio del despacho, no de *.onrender.com.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Visores: solo se pueden incrustar en páginas de la propia app.
        source: "/api/:kind(documentos|escritos)/:id/ver",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
