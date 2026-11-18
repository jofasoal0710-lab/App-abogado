import "server-only";
import { db, type Db } from "@/db";
import { clientAccessLog, matterAccessLog } from "@/db/schema";

type Action = (typeof matterAccessLog.$inferInsert)["action"];

export async function logAccessChange(matterId: number, actorId: number, action: Action, detail: string, dbx: Db = db) {
  await dbx.insert(matterAccessLog).values({ matterId, actorId, action, detail });
}

export async function logClientAccessChange(clientId: number, actorId: number, detail: string, dbx: Db = db) {
  await dbx.insert(clientAccessLog).values({ clientId, actorId, detail });
}
