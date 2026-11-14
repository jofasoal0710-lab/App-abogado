import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los documentos se suben mediante Server Actions: límite algo por encima de los 25 MB permitidos.
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
  serverExternalPackages: ["pg"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
