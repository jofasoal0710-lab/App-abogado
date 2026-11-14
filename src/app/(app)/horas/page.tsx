import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, matters, timeEntries, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { currentMonth, monthLabel, shiftMonth, todayISO } from "@/lib/dates";
import { qs } from "@/lib/search";
import { TimeEntriesTable } from "./time-entries-table";
import { TimeEntryForm } from "./time-entry-form";

export const metadata: Metadata = { title: "Horas" };

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; todos?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes ?? "") ? sp.mes! : currentMonth();
  const all = sp.todos === "1";

  const start = `${month}-01`;
  const end = `${shiftMonth(month, 1)}-01`;

  const [rows, openMatters] = await Promise.all([
    db
      .select({
        id: timeEntries.id,
        workedOn: timeEntries.workedOn,
        minutes: timeEntries.minutes,
        description: timeEntries.description,
        rateCents: timeEntries.rateCents,
        billable: timeEntries.billable,
        invoiceId: timeEntries.invoiceId,
        userId: timeEntries.userId,
        userName: users.name,
        matterId: matters.id,
        matterNumber: matters.number,
      })
      .from(timeEntries)
      .innerJoin(users, eq(users.id, timeEntries.userId))
      .innerJoin(matters, eq(matters.id, timeEntries.matterId))
      .where(
        and(
          gte(timeEntries.workedOn, start),
          lt(timeEntries.workedOn, end),
          all ? undefined : eq(timeEntries.userId, user.id),
        ),
      )
      .orderBy(desc(timeEntries.workedOn), desc(timeEntries.id)),
    db
      .select({ id: matters.id, number: matters.number, title: matters.title, client: clients.name })
      .from(matters)
      .innerJoin(clients, eq(clients.id, matters.clientId))
      .where(inArray(matters.status, ["abierto", "en_curso", "en_espera"]))
      .orderBy(asc(clients.name), asc(matters.number)),
  ]);

  const isCurrent = month === currentMonth();
  return (
    <>
      <PageHeader title="Horas" subtitle={`${monthLabel(month)} · ${all ? "todo el equipo" : "mis horas"}`} />

      <section className="mb-6">
        <TimeEntryForm
          matterOptions={openMatters.map((m) => ({ id: m.id, label: `${m.number} · ${m.client} · ${m.title}` }))}
          defaultRateCents={user.hourlyRateCents}
        />
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link className="btn-secondary btn-sm" href={`/horas${qs({ mes: shiftMonth(month, -1), todos: all ? "1" : "" })}`}>
            ← Mes anterior
          </Link>
          {!isCurrent && (
            <Link className="btn-secondary btn-sm" href={`/horas${qs({ todos: all ? "1" : "" })}`}>
              Hoy ({todayISO().slice(0, 7)})
            </Link>
          )}
          <Link className="btn-secondary btn-sm" href={`/horas${qs({ mes: shiftMonth(month, 1), todos: all ? "1" : "" })}`}>
            Mes siguiente →
          </Link>
        </div>
        <Link className="link text-sm" href={`/horas${qs({ mes: month, todos: all ? "" : "1" })}`}>
          {all ? "Ver solo mis horas" : "Ver horas de todo el equipo"}
        </Link>
      </div>

      <div className="card">
        <TimeEntriesTable rows={rows} user={user} />
      </div>
    </>
  );
}
