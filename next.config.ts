import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los documentos se suben mediante Server Actions: límite algo por encima de los 25 MB permitidos.
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
  serverExternalPackages: ["pg", "@dojocoding/hacienda-sdk"],
  // No anunciar el framework en cada respuesta (X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
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
    ];
  },
};

export default nextConfig;
