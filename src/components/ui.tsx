import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-medium text-ink-700">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  tone?: "default" | "warn" | "danger";
}) {
  const color =
    tone === "danger" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-ink-900";
  const body = (
    <div className="card card-pad h-full transition-shadow hover:shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-2 font-serif text-3xl font-semibold ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const matterStatusTone: Record<string, string> = {
  abierto: "badge-blue",
  en_curso: "badge-green",
  en_espera: "badge-amber",
  cerrado: "badge-gray",
  archivado: "badge-gray",
};
const invoiceStatusTone: Record<string, string> = {
  borrador: "badge-gray",
  emitida: "badge-blue",
  pagada: "badge-green",
  anulada: "badge-red",
};
const eventKindTone: Record<string, string> = {
  audiencia: "badge-red",
  plazo: "badge-amber",
  reunion: "badge-blue",
  tarea: "badge-gray",
};

export function Badge({
  kind,
  value,
  label,
}: {
  kind: "matter" | "invoice" | "event";
  value: string;
  label: string;
}) {
  const map = kind === "matter" ? matterStatusTone : kind === "invoice" ? invoiceStatusTone : eventKindTone;
  return <span className={map[value] ?? "badge-gray"}>{label}</span>;
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="no-print flex items-center justify-between border-t border-ink-100 px-4 py-3 text-sm text-ink-600" aria-label="Paginación">
      <span>
        Página {page} de {pages} · {total} resultados
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <Link className="btn-secondary btn-sm" href={hrefFor(page - 1)}>
            Anterior
          </Link>
        )}
        {page < pages && (
          <Link className="btn-secondary btn-sm" href={hrefFor(page + 1)}>
            Siguiente
          </Link>
        )}
      </span>
    </nav>
  );
}
