import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { IndexState } from "@/lib/notary-index";
import type { Quincena } from "@/lib/notary-period";

/** Aviso de índices notariales sin presentar en INDEX. */
export function IndexAlert({ pending }: { pending: { q: Quincena; state: IndexState }[] }) {
  if (pending.length === 0) return null;
  const late = pending.some((p) => p.state.kind === "vencido");
  return (
    <div role="status" className={`mb-4 rounded-md border px-4 py-3 text-sm ${late ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <p className="font-medium">{late ? "Índice notarial vencido sin presentar en INDEX" : "Índice notarial pendiente de presentar en INDEX"}</p>
      <ul className="mt-1 space-y-0.5">
        {pending.map(({ q, state }) => (
          <li key={q.key}>
            <Link className="link" href={`/notaria/indice?q=${q.key}`}>
              {q.label}
            </Link>
            {"due" in state && ` · ${state.kind === "vencido" ? "venció" : "vence"} el ${formatDate(state.due)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
