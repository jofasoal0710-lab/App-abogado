import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

/**
 * Añade la política de seguridad de contenido con un nonce nuevo en cada página (ver lib/csp.ts).
 * Next.js lee el nonce de la cabecera de la petición y lo pone en sus propios scripts.
 *
 * Importante: esto NO es un control de acceso. Cada página, ruta y acción comprueba por sí misma la
 * sesión y los permisos (ver lib/auth.ts); aquí solo se añaden cabeceras.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Páginas (no la API, que devuelve datos y ficheros, ni los recursos estáticos).
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
