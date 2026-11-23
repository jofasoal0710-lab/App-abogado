"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { documents, matters, portalLinks } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { getAccessibleClient, getAccessibleMatter } from "@/lib/access";
import { CLIENT_ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { stampSessionActor } from "@/lib/data-audit";
import { can } from "@/lib/permissions";
import { hashPortalToken, linkDays, newPortalToken } from "@/lib/portal-core";
import { getReminderConfig } from "@/lib/reminders/config";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";

/** Quién gestiona el portal de un cliente: quien puede gestionar ese cliente (igual que su ficha). */
async function managedClient(user: CurrentUser, clientId: number) {
  const client = await getAccessibleClient(user, clientId);
  if (!client) return null;
  const ok = can(user, "clientes.gestionar_todos") || (can(user, "clientes.gestionar") && client.createdById === user.id);
  return ok ? client : null;
}

/** Crea un enlace de acceso al portal. El enlace se muestra UNA vez (solo se guarda su hash). */
export async function createPortalLinkAction(clientId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const client = await managedClient(user, clientId);
  if (!client) return { error: CLIENT_ACCESS_DENIED };
  const label = str(formData, "label").trim().slice(0, 120);
  if (label.length < 2) return { error: "Indica para quién es el enlace (p. ej. el nombre de la persona)." };
  const days = linkDays(str(formData, "days"));
  if (days === null) return { error: "La validez debe ser de 1 a 90 días." };
  const token = newPortalToken();
  const [row] = await db
    .insert(portalLinks)
    .values({ clientId, tokenHash: hashPortalToken(token), label, expiresAt: new Date(Date.now() + days * 86_400_000), createdById: user.id })
    .returning({ id: portalLinks.id });
  const { ip } = await requestMeta();
  await logSecurityEvent("portal_enlace_creado", { actorId: user.id, ip, detail: `${client.name} · «${label}» · ${days} días (#${row.id})` });
  revalidatePath(`/clientes/${clientId}`);
  const url = `${getReminderConfig().appUrl.replace(/\/$/, "")}/portal/entrar?t=${token}`;
  return { ok: `Enlace creado. Cópialo ahora y envíalo al cliente por un medio seguro (no se volverá a mostrar): ${url}` };
}

export async function revokePortalLinkAction(linkId: number, clientId: number): Promise<void> {
  const user = await requireUser();
  const client = await managedClient(user, clientId);
  if (!client) return;
  const [r] = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    return tx.update(portalLinks).set({ revokedAt: new Date() }).where(and(eq(portalLinks.id, linkId), eq(portalLinks.clientId, clientId), isNull(portalLinks.revokedAt))).returning({ label: portalLinks.label });
  });
  if (r) {
    const { ip } = await requestMeta();
    await logSecurityEvent("portal_enlace_revocado", { actorId: user.id, ip, detail: `${client.name} · «${r.label}» (#${linkId})` });
  }
  revalidatePath(`/clientes/${clientId}`);
}

/** Muestra u oculta un expediente en el portal de su cliente. */
export async function toggleMatterPortalAction(matterId: number): Promise<void> {
  const user = await requireUser();
  const matter = await getAccessibleMatter(user, matterId);
  if (!matter || !(await managedClient(user, matter.clientId))) return;
  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx.update(matters).set({ portalShared: !matter.portalShared }).where(eq(matters.id, matterId));
  });
  revalidatePath(`/clientes/${matter.clientId}`);
  revalidatePath(`/expedientes/${matterId}`);
}

/** Comparte o deja de compartir un documento con el cliente (solo se ve si el expediente también está compartido). */
export async function toggleDocumentPortalAction(documentId: number, matterId: number): Promise<void> {
  const user = await requireUser();
  const matter = await getAccessibleMatter(user, matterId);
  if (!matter || !(await managedClient(user, matter.clientId))) return;
  const [d] = await db.select({ shared: documents.portalShared }).from(documents).where(and(eq(documents.id, documentId), eq(documents.matterId, matterId)));
  if (!d) return;
  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx.update(documents).set({ portalShared: !d.shared }).where(eq(documents.id, documentId));
  });
  revalidatePath(`/expedientes/${matterId}`);
}
