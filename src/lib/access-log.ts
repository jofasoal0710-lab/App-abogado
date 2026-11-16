import "server-only";
import { db } from "@/db";
import { clientAccessLog, matterAccessLog } from "@/db/schema";

type Action = (typeof matterAccessLog.$inferInsert)["action"];

export async function logAccessChange(matterId: number, actorId: number, action: Action, detail: string) {
  await db.insert(matterAccessLog).values({ matterId, actorId, action, detail });
}

export async function logClientAccessChange(clientId: number, actorId: number, detail: string) {
  await db.insert(clientAccessLog).values({ clientId, actorId, detail });
}
