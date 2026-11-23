import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { portalLinks } from "@/db/schema";
import { portalLinkForToken } from "@/lib/portal";
import { PORTAL_COOKIE, PORTAL_SESSION_SECONDS } from "@/lib/portal-core";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";

export const dynamic = "force-dynamic";

/**
 * El enlace que recibe el cliente (/portal/entrar?t=…): si es válido, se guarda en una cookie propia del
 * portal y se redirige a /portal, de modo que el token no queda en la barra de direcciones ni en el historial.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const link = await portalLinkForToken(token);
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (!link) return NextResponse.redirect(new URL("/portal/caducado", url), { status: 303, headers });

  const [prev] = await db.update(portalLinks).set({ lastUsedAt: new Date() }).where(eq(portalLinks.id, link.linkId)).returning({ id: portalLinks.id });
  if (prev) {
    const { ip } = await requestMeta();
    await logSecurityEvent("portal_entrada", { ip, detail: `${link.clientName} · enlace «${link.label}» (#${link.linkId})` });
  }
  const res = NextResponse.redirect(new URL("/portal", url), { status: 303, headers });
  res.cookies.set(PORTAL_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: PORTAL_SESSION_SECONDS });
  return res;
}
