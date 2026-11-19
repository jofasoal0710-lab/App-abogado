import Link from "next/link";
import { ConfirmButton } from "@/components/form";
import { EmptyState } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatDuration, formatMoney, timeAmountCents } from "@/lib/money";
import { deleteTimeEntryAction } from "./actions";
import { can } from "@/lib/permissions";
import { BULK_FORM_ID, BulkDeleteBar } from "./bulk-delete";

export type TimeRow = {
  id: number;
  workedOn: string;
  minutes: number;
  description: string;
  rateCents: number;
  billable: boolean;
  invoiceId: number | null;
  userId: number;
  userName: string;
  matterId: number;
  matterNumber: string;
};

export function TimeEntriesTable({
  rows,
  user,
  showMatter = true,
  returnTo = "/horas",
}: {
  rows: TimeRow[];
  user: CurrentUser;
  showMatter?: boolean;
  /** A dónde volver tras corregir una entrada. */
  returnTo?: string;
}) {
  if (rows.length === 0) return <EmptyState title="Sin horas registradas" />;
  const totalMinutes = rows.reduce((s, r) => s + r.minutes, 0);
  const totalCents = rows.filter((r) => r.billable).reduce((s, r) => s + timeAmountCents(r.minutes, r.rateCents), 0);
  const editable = (r: TimeRow) => r.invoiceId === null && (can(user, "horas.borrar_todas") || r.userId === user.id);
  const selectable = rows.filter(editable).length;

  return (
    <div className="overflow-x-auto">
      <BulkDeleteBar selectable={selectable} />
      <table className="table">
        <thead>
          <tr>
            <th className="w-px">
              <span className="sr-only">Marcar</span>
            </th>
            <th>Fecha</th>
            {showMatter && <th>Expediente</th>}
            <th>Trabajo</th>
            <th>Abogado</th>
            <th className="text-right">Tiempo</th>
            <th className="text-right">Importe</th>
            <th className="w-px" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const canDelete = editable(r);
            return (
              <tr key={r.id}>
                <td>
                  {canDelete && (
                    <input
                      type="checkbox"
                      name="ids"
                      value={r.id}
                      form={BULK_FORM_ID}
                      aria-label={`Marcar la entrada del ${formatDate(r.workedOn)}: ${r.description}`}
                      className="h-4 w-4 accent-brand-600"
                    />
                  )}
                </td>
                <td className="whitespace-nowrap">{formatDate(r.workedOn)}</td>
                {showMatter && (
                  <td>
                    <Link className="link" href={`/expedientes/${r.matterId}`}>
                      {r.matterNumber}
                    </Link>
                  </td>
                )}
                <td>
                  {r.description}
                  <span className="ml-2 inline-flex gap-1 align-middle">
                    {!r.billable && <span className="badge-gray">No facturable</span>}
                    {r.invoiceId !== null && (
                      <Link href={`/facturas/${r.invoiceId}`} className="badge-green">
                        Facturado
                      </Link>
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap">{r.userName}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatDuration(r.minutes)}</td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {r.billable ? formatMoney(timeAmountCents(r.minutes, r.rateCents)) : "—"}
                </td>
                <td>
                  {canDelete && (
                    <span className="flex items-center gap-1">
                      <Link href={`/horas/${r.id}/editar?volver=${encodeURIComponent(returnTo)}`} className="btn-ghost btn-sm">
                        Corregir
                      </Link>
                      <form action={deleteTimeEntryAction.bind(null, r.id)}>
                        <ConfirmButton message="¿Eliminar esta entrada de horas?" className="btn-ghost btn-sm text-red-700">
                          Borrar
                        </ConfirmButton>
                      </form>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-ink-50 font-semibold">
            <td colSpan={showMatter ? 5 : 4} className="px-4 py-2.5 text-right">
              Total
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatDuration(totalMinutes)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(totalCents)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
