import Link from "next/link";
import { Icon, type IconName } from "./icons";

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
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  icon?: IconName;
  tone?: "default" | "warn" | "danger";
}) {
  const color = tone === "danger" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-ink-900";
  const chip = tone === "danger" ? "bg-red-50 text-red-600" : tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-600";
  const body = (
    <div className={`card card-pad h-full transition-colors ${href ? "hover:border-brand-300" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        {icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${chip}`}>
            <Icon name={icon} className="h-5 w-5" />
          </span>
        )}
      </div>
      <p className={`mt-1 font-serif text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
      {body}
    </Link>
  ) : (
    body
  );
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

export type Crumb = { label: string; href?: string; title?: string };

/** Ruta de acceso («Normativa › Laboral › Código de Trabajo › Título II › Art. 29»). La última es la página actual. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta" className="no-print mb-3 overflow-x-auto">
      <ol className="flex items-center gap-1 whitespace-nowrap text-sm text-ink-500">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <span aria-hidden="true" className="text-ink-300">
                  ›
                </span>
              )}
              {c.href && !last ? (
                <Link href={c.href} title={c.title} className="max-w-[16rem] truncate hover:text-brand-700 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span title={c.title} aria-current={last ? "page" : undefined} className={`max-w-[20rem] truncate ${last ? "font-medium text-ink-800" : ""}`}>
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
