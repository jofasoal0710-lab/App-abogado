"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { intakeFiles, intakeRequests } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { INTAKE_GLOBAL_PER_HOUR, INTAKE_MAX_FILES, INTAKE_PER_IP_PER_HOUR, checkIntakeFile, magicMatches, parseIntake } from "@/lib/intake";
import { getIntakeSettings, notifyNewIntake } from "@/lib/intake-db";
import { consumeQuota } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/security-log";
import { deleteFile, saveServerFile } from "@/lib/storage";

export type IntakeState = { errors?: string[] } | undefined;

const TEXT_FIELDS = ["clientType", "name", "idType", "taxId", "birthDate", "maritalStatus", "email", "phone", "address", "area", "summary", "opposingParty", "deadline", "preferredContact", "consent"] as const;

/**
 * Envío del formulario público. No requiere sesión: por eso valida todo en el servidor, limita los envíos
 * (por IP y en total), comprueba el contenido real de los adjuntos y nunca da acceso a nada del despacho.
 */
export async function submitIntakeAction(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const settings = await getIntakeSettings();
  if (!settings.enabled) return { errors: ["El formulario no está disponible en este momento. Contacta al despacho por teléfono o correo."] };
  // Campo trampa invisible: solo lo rellenan los robots. Se responde como si todo hubiera ido bien.
  if (String(formData.get("website") ?? "").trim()) redirect("/solicitud/enviada");

  const raw: Record<string, string | undefined> = {};
  for (const k of TEXT_FIELDS) {
    const v = formData.get(k);
    raw[k] = typeof v === "string" ? v : undefined;
  }
  const parsed = parseIntake(raw, todayISO());
  const errors = parsed.ok ? [] : [...parsed.errors];

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > INTAKE_MAX_FILES) errors.push(`Puedes adjuntar como máximo ${INTAKE_MAX_FILES} documentos.`);
  const checked: { name: string; mimeType: string; data: Buffer }[] = [];
  for (const f of files.slice(0, INTAKE_MAX_FILES)) {
    const c = checkIntakeFile(f.name, f.size);
    if (!c.ok) {
      errors.push(c.error);
      continue;
    }
    const data = Buffer.from(await f.arrayBuffer());
    if (!magicMatches(c.mimeType, data.subarray(0, 16))) {
      errors.push(`«${c.name}» no parece ser un archivo del tipo que indica su nombre.`);
      continue;
    }
    checked.push({ name: c.name, mimeType: c.mimeType, data });
  }
  if (errors.length || !parsed.ok) return { errors };

  const { ip } = await requestMeta();
  if (ip !== "local" && (await consumeQuota(`intake|ip|${ip}`, INTAKE_PER_IP_PER_HOUR, 60))) {
    return { errors: ["Has enviado varias solicitudes en poco tiempo. Espera un rato o contacta al despacho por teléfono."] };
  }
  if (await consumeQuota("intake|global", INTAKE_GLOBAL_PER_HOUR, 60)) {
    return { errors: ["El formulario está recibiendo muchas solicitudes ahora mismo. Inténtalo de nuevo en una hora o contacta al despacho por teléfono."] };
  }

  const saved: string[] = [];
  let id: number;
  try {
    for (const f of checked) saved.push(await saveServerFile(f.data, f.name, f.mimeType));
    id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(intakeRequests)
        .values({ ...parsed.data, consentAt: new Date() })
        .returning({ id: intakeRequests.id });
      if (checked.length) {
        await tx.insert(intakeFiles).values(checked.map((f, i) => ({ requestId: row.id, name: f.name, mimeType: f.mimeType, sizeBytes: f.data.length, storageKey: saved[i] })));
      }
      return row.id;
    });
  } catch (err) {
    for (const k of saved) await deleteFile(k).catch(() => undefined);
    console.error("[solicitudes] No se pudo guardar una solicitud:", err);
    return { errors: ["No se pudo enviar la solicitud por un problema técnico. Inténtalo de nuevo en unos minutos."] };
  }
  await notifyNewIntake(id, parsed.data.area).catch(() => 0);
  redirect("/solicitud/enviada");
}
