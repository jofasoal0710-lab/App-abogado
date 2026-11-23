import { getCurrentUser } from "@/lib/auth";
import { readBackup } from "@/lib/backup";
import { can } from "@/lib/permissions";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";
import { BACKUP_KEY_PATTERN } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Descarga de una copia de seguridad: solo quien gestiona el equipo, y queda registrada. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!can(user, "equipo.gestionar")) return new Response("Prohibido", { status: 403 });
  const key = new URL(req.url).searchParams.get("clave") ?? "";
  if (!BACKUP_KEY_PATTERN.test(key)) return new Response("Copia no válida", { status: 400 });
  const data = await readBackup(key);
  if (!data) return new Response("No existe", { status: 404 });
  const { ip } = await requestMeta();
  await logSecurityEvent("respaldo_descargado", { actorId: user.id, targetId: user.id, ip, detail: key });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="${key.replace("respaldos/", "")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
