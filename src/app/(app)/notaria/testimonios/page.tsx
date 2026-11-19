import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { deeds, testimonies } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { NotaryNav } from "../notary-nav";

export const metadata: Metadata = { title: "Testimonios" };

/** Testimonios expedidos de las escrituras del propio notario. */
export default async function TestimoniesPage() {
  const user = await requirePermission("notaria.usar");
  const rows = await db
    .select({ id: testimonies.id, ordinal: testimonies.ordinal, issuedOn: testimonies.issuedOn, issuedTo: testimonies.issuedTo, deedId: deeds.id, number: deeds.number, act: deeds.act })
    .from(testimonies)
    .innerJoin(deeds, eq(deeds.id, testimonies.deedId))
    .where(eq(deeds.notaryId, user.id))
    .orderBy(desc(testimonies.issuedOn), desc(testimonies.id))
    .limit(200);
  return (
    <>
      <PageHeader title="Gestor notarial" subtitle="Testimonios expedidos" />
      <NotaryNav current="/notaria/testimonios" />
      <section className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="Aún no hay testimonios">Se registran desde cada escritura.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Escritura</th>
                <th>Testimonio</th>
                <th>Expedido para</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{formatDate(t.issuedOn)}</td>
                  <td>
                    <Link href={`/notaria/escrituras/${t.deedId}`} className="link">
                      N.º {t.number}
                    </Link>{" "}
                    · {t.act}
                  </td>
                  <td>{t.ordinal}.º</td>
                  <td>{t.issuedTo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
