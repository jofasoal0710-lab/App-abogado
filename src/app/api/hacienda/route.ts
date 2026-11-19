import { getCurrentUser } from "@/lib/auth";
import { onlyDigits } from "@/lib/cr-id";

export const dynamic = "force-dynamic";

/**
 * Consulta el nombre de una persona o empresa en el servicio público de contribuyentes del Ministerio
 * de Hacienda de Costa Rica (solo responde por quien está inscrito como contribuyente). La consulta la
 * hace el servidor: el navegador solo habla con la propia aplicación (la CSP no cambia).
 *
 * Solo para usuarios con sesión, con un límite por persona, y sin guardar nada: el formulario rellena el
 * nombre y la persona decide si lo guarda.
 */
const HACIENDA_URL = () => process.env.HACIENDA_API_URL || "https://api.hacienda.go.cr/fe/ae";
const TIMEOUT_MS = 8000;
const MAX_PER_MINUTE = 20;
const recent = new Map<number, number[]>();

const TYPE_BY_CODE: Record<string, string> = { "01": "cedula_fisica", "02": "cedula_juridica", "03": "dimex", "04": "nite" };

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Inicia sesión para consultar." }, { status: 401 });

  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000);
  if (mine.length >= MAX_PER_MINUTE) return Response.json({ error: "Demasiadas consultas seguidas. Espera un minuto." }, { status: 429 });
  recent.set(user.id, [...mine, now]);

  const id = onlyDigits(new URL(req.url).searchParams.get("id") ?? "");
  if (!/^\d{9,12}$/.test(id)) return Response.json({ error: "Escribe una cédula física (9 dígitos), jurídica (10) o DIMEX (11-12)." }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`${HACIENDA_URL()}?identificacion=${id}`, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json" }, cache: "no-store" });
  } catch {
    return Response.json({ error: "Hacienda no responde ahora mismo. Inténtalo más tarde o escribe los datos a mano." }, { status: 502 });
  }
  if (res.status === 404) return Response.json({ error: "Hacienda no tiene registrado ese número como contribuyente. Escribe el nombre a mano." }, { status: 404 });
  if (!res.ok) return Response.json({ error: `Hacienda respondió con un error (${res.status}). Escribe los datos a mano.` }, { status: 502 });

  let data: { nombre?: unknown; tipoIdentificacion?: unknown; situacion?: { estado?: unknown } };
  try {
    data = await res.json();
  } catch {
    return Response.json({ error: "Respuesta de Hacienda no válida." }, { status: 502 });
  }
  const name = typeof data.nombre === "string" ? data.nombre.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  if (!name) return Response.json({ error: "Hacienda no devolvió un nombre para ese número." }, { status: 404 });
  const code = typeof data.tipoIdentificacion === "string" ? data.tipoIdentificacion : "";
  const status = typeof data.situacion?.estado === "string" ? data.situacion.estado.slice(0, 60) : null;
  return Response.json({ name, idType: TYPE_BY_CODE[code] ?? null, status });
}
