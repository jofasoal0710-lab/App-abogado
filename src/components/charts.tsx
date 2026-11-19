import Link from "next/link";

/**
 * Gráficos sencillos dibujados en el servidor con SVG y HTML: sin librerías ni JavaScript en el
 * navegador (la CSP no cambia) y siempre con las cifras escritas, para que no dependan del color.
 */

/** Paleta categórica (azules y tonos fríos distinguibles entre sí, contraste ≥ 3:1 sobre blanco). */
export const SERIES = ["#1f57b8", "#4f86e0", "#0f8a7e", "#7a5bd1", "#c2410c", "#b7791f", "#64748b", "#0e7490", "#be185d"];

export type Slice = { key: string; label: string; value: number; color?: string };

/** Anillo con el total en el centro y leyenda con valores. */
export function Donut({ data, centerLabel, emptyText }: { data: Slice[]; centerLabel: string; emptyText: string }) {
  const items = data.filter((d) => d.value > 0).map((d, i) => ({ ...d, color: d.color ?? SERIES[i % SERIES.length] }));
  const total = items.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="py-10 text-center text-sm text-ink-500">{emptyText}</p>;

  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={`${centerLabel}: ${total}`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-ink-100)" strokeWidth="16" />
        {items.map((d) => {
          const len = (d.value / total) * c;
          const el = (
            <circle
              key={d.key}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="16"
              strokeDasharray={`${Math.max(len - (items.length > 1 ? 1.5 : 0), 0.01)} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: "60px 60px" }}>
          <text x="60" y="60" textAnchor="middle" className="fill-ink-900 font-serif text-[26px] font-semibold">
            {total}
          </text>
          <text x="60" y="76" textAnchor="middle" className="fill-ink-500 text-[9px]">
            {centerLabel}
          </text>
        </g>
      </svg>
      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {items.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-ink-700">{d.label}</span>
            <span className="font-medium tabular-nums text-ink-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontales con su valor; útil para estados o categorías con nombres largos. */
export function BarList({ data, emptyText, format = String }: { data: (Slice & { href?: string })[]; emptyText: string; format?: (n: number) => string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (max === 0) return <p className="py-10 text-center text-sm text-ink-500">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {data.map((d, i) => {
        const label = d.href ? (
          <Link href={d.href} className="hover:text-brand-700 hover:underline">
            {d.label}
          </Link>
        ) : (
          d.label
        );
        return (
          <li key={d.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink-700">{label}</span>
              <span className="font-medium tabular-nums text-ink-900">{format(d.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-ink-100">
              <div
                className="h-2 rounded-full"
                style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%`, background: d.color ?? SERIES[i % SERIES.length] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Columnas por periodo (p. ej. cobros por mes), con el valor encima de cada una. */
export function Columns({ data, format, emptyText }: { data: { key: string; label: string; value: number; current?: boolean }[]; format: (n: number) => string; emptyText: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex h-44 items-end gap-2 border-b border-ink-200 sm:gap-3" role="list">
        {data.map((d) => (
          <div key={d.key} role="listitem" className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] font-medium tabular-nums text-ink-600">{d.value > 0 ? format(d.value) : ""}</span>
            <div
              className={`w-full max-w-10 rounded-t-md ${d.current ? "bg-brand-600" : "bg-brand-300"}`}
              style={{ height: max > 0 ? `${Math.max((d.value / max) * 78, d.value > 0 ? 2 : 0)}%` : "0%" }}
              title={`${d.label}: ${format(d.value)}`}
            />
            <span className="sr-only">
              {d.label}: {format(d.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 sm:gap-3" aria-hidden="true">
        {data.map((d) => (
          <span key={d.key} className={`min-w-0 flex-1 text-center text-xs ${d.current ? "font-semibold text-ink-800" : "text-ink-500"}`}>
            {d.label}
          </span>
        ))}
      </div>
      {max === 0 && <p className="mt-3 text-center text-sm text-ink-500">{emptyText}</p>}
    </div>
  );
}
