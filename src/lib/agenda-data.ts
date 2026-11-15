import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { matterAccessSql } from "@/lib/access";
import type { CurrentUser } from "@/lib/auth";
import { clients, events, matters, users } from "@/db/schema";

export const eventSelect = {
  id: events.id,
  title: events.title,
  kind: events.kind,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  location: events.location,
  completed: events.completed,
  matterId: matters.id,
  matterNumber: matters.number,
  assignedName: users.name,
};

/** Opciones para los selectores del formulario de eventos. */
export async function eventFormOptions(user: CurrentUser) {
  const [matterRows, userRows] = await Promise.all([
    db
      .select({ id: matters.id, number: matters.number, title: matters.title, client: clients.name })
      .from(matters)
      .innerJoin(clients, eq(clients.id, matters.clientId))
      .where(matterAccessSql(user, matters.id))
      .orderBy(asc(clients.name), asc(matters.number)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
  ]);
  return {
    matters: matterRows.map((m) => ({ id: m.id, label: `${m.number} · ${m.client} · ${m.title}` })),
    users: userRows,
  };
}
