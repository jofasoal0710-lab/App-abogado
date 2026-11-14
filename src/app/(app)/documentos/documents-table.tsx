import Link from "next/link";
import { ConfirmButton } from "@/components/form";
import { EmptyState } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatBytes } from "@/lib/file-types";
import { deleteDocumentAction } from "./actions";

export type DocRow = {
  id: number;
  name: string;
  category: string | null;
  sizeBytes: number;
  createdAt: Date;
  uploader: string | null;
  matterId: number;
  matterNumber: string;
};

export function DocumentsTable({
  rows,
  user,
  showMatter = true,
}: {
  rows: DocRow[];
  user: CurrentUser;
  showMatter?: boolean;
}) {
  if (rows.length === 0) return <EmptyState title="Sin documentos" />;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Documento</th>
            {showMatter && <th>Expediente</th>}
            <th>Categoría</th>
            <th>Subido por</th>
            <th>Fecha</th>
            <th className="text-right">Tamaño</th>
            <th className="w-px" />
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>
                <a className="link" href={`/api/documentos/${d.id}`}>
                  {d.name}
                </a>
              </td>
              {showMatter && (
                <td>
                  <Link className="link" href={`/expedientes/${d.matterId}?tab=documentos`}>
                    {d.matterNumber}
                  </Link>
                </td>
              )}
              <td>{d.category ?? "—"}</td>
              <td>{d.uploader ?? "—"}</td>
              <td className="whitespace-nowrap">{formatDate(d.createdAt)}</td>
              <td className="whitespace-nowrap text-right tabular-nums">{formatBytes(d.sizeBytes)}</td>
              <td>
                {user.role !== "asistente" && (
                  <form action={deleteDocumentAction.bind(null, d.id)}>
                    <ConfirmButton message={`¿Eliminar «${d.name}»? El archivo se borrará definitivamente.`} className="btn-ghost btn-sm text-red-700">
                      Borrar
                    </ConfirmButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
