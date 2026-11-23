"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_COOKIE } from "@/lib/portal-core";

/** Cierra la sesión del portal en este navegador (el enlace sigue valiendo hasta que caduque). */
export async function portalLogoutAction() {
  (await cookies()).delete(PORTAL_COOKIE);
  redirect("/portal/salida");
}
