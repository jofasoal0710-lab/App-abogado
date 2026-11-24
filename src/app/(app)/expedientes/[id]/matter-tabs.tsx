"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon, type IconName } from "@/components/icons";

export type MatterTab = { key: string; label: string; icon: IconName; group: string; count?: number; alert?: boolean; secondary?: boolean };

/**
 * Pestañas del expediente: las de uso diario siempre visibles (agrupadas, con icono y contador) y las
 * de consulta/administración en «Más». En pantallas estrechas, un selector: once pestañas no caben en un móvil.
 */
export function MatterTabs({ tabs, active, base }: { tabs: MatterTab[]; active: string; base: string }) {
  const router = useRouter();
  const href = (k: string) => (k === "resumen" ? base : `${base}?tab=${k}`);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  const primary = tabs.filter((t) => !t.secondary);
  const more = tabs.filter((t) => t.secondary);
  const groups = [...new Set(primary.map((t) => t.group))];
  const moreActive = more.find((t) => t.key === active);

  // El menú «Más» se cierra al cambiar de pestaña, al pulsar fuera o con Escape.
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname, search]);
  useEffect(() => {
    const close = (e: Event) => {
      const d = menu.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const pill = (t: MatterTab, on: boolean) => (
    <>
      <Icon name={t.icon} className="hidden h-4 w-4 xl:block" />
      {t.label}
      {t.count ? (
        <span className={`min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums ${on ? "bg-white/20 text-white" : t.alert ? "bg-red-100 text-red-700" : "bg-ink-100 text-ink-600"}`}>
          {t.count}
        </span>
      ) : null}
    </>
  );
  const pillClass = (on: boolean) =>
    `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
    }`;

  return (
    <nav className="no-print mb-6" aria-label="Secciones del expediente">
      {/* Móvil: selector con la sección actual. */}
      <label className="block md:hidden">
        <span className="sr-only">Sección del expediente</span>
        <span className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 text-brand-700">
            <Icon name={current.icon} className="h-5 w-5" />
          </span>
          <select className="input appearance-none py-2.5 pl-10 pr-9 font-medium" value={current.key} onChange={(e) => router.push(href(e.target.value))}>
            {[...new Set(tabs.map((t) => t.group))].map((g) => (
              <optgroup key={g} label={g}>
                {tabs
                  .filter((t) => t.group === g)
                  .map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                      {t.count ? ` (${t.count})` : ""}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 text-ink-400" aria-hidden>
            ▾
          </span>
        </span>
      </label>

      {/* Escritorio: grupos de píldoras + «Más». */}
      <div className="hidden items-center gap-0.5 rounded-xl border border-ink-200 bg-white p-1 shadow-sm md:flex">
        {groups.map((g, gi) => (
          <div key={g} className="flex shrink-0 items-center gap-0.5" role="group" aria-label={g}>
            {gi > 0 && <span className="mx-1 h-5 w-px bg-ink-200 opacity-60" aria-hidden />}
            {primary
              .filter((t) => t.group === g)
              .map((t) => (
                <Link key={t.key} href={href(t.key)} aria-current={t.key === active ? "page" : undefined} className={pillClass(t.key === active)}>
                  {pill(t, t.key === active)}
                </Link>
              ))}
          </div>
        ))}
        {more.length > 0 && (
          <>
            <span className="mx-1 h-5 w-px bg-ink-200 opacity-60" aria-hidden />
            <details ref={menu} className="relative">
              <summary className={`${pillClass(!!moreActive)} cursor-pointer list-none`} aria-label={moreActive ? `Más secciones (ahora: ${moreActive.label})` : "Más secciones"}>
                {moreActive ? pill(moreActive, true) : "Más"}
                <span aria-hidden className="text-xs">▾</span>
              </summary>
              <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border border-ink-200 bg-white p-1 shadow-lg">
                {more.map((t) => (
                  <Link
                    key={t.key}
                    href={href(t.key)}
                    aria-current={t.key === active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${t.key === active ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-700 hover:bg-ink-100"}`}
                  >
                    <Icon name={t.icon} className="h-4 w-4" />
                    {t.label}
                    {t.group !== t.label && <span className="ml-auto text-xs text-ink-400">{t.group}</span>}
                  </Link>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </nav>
  );
}
