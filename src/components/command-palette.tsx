"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

type Hit = { group: string; label: string; detail?: string; href: string };

/** Abre la búsqueda global desde cualquier sitio (lo usan el botón del menú y el atajo). */
export function openCommandPalette() {
  window.dispatchEvent(new Event("abrir-busqueda"));
}

/**
 * Búsqueda global y acciones (Ctrl+K / ⌘K): expedientes, clientes, escritos, facturas, documentos,
 * formularios, conocimiento y leyes, siempre con los permisos de quien busca (lo filtra el servidor).
 */
export function CommandPalette() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  const open = useCallback(() => {
    if (!ref.current?.open) ref.current?.showModal();
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("abrir-busqueda", open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("abrir-busqueda", open);
    };
  }, [open]);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (r.ok) {
          setHits(await r.json());
          setActive(0);
        }
      } catch {
        /* cancelada o sin red */
      } finally {
        setLoading(false);
      }
    }, q ? 200 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (h: Hit) => {
    ref.current?.close();
    setQ("");
    router.push(h.href);
  };

  // Resultados agrupados, conservando el orden.
  const groups: [string, (Hit & { i: number })[]][] = [];
  hits.forEach((h, i) => {
    const g = groups.find(([name]) => name === h.group);
    if (g) g[1].push({ ...h, i });
    else groups.push([h.group, [{ ...h, i }]]);
  });

  return (
    <dialog
      ref={ref}
      aria-label="Buscar en la aplicación"
      className="m-auto mt-[12vh] w-[min(40rem,94vw)] rounded-xl border border-ink-200 bg-surface p-0 text-ink-800 shadow-2xl backdrop:bg-ink-900/40"
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="flex items-center gap-2 border-b border-ink-200 px-4">
        <Icon name="buscar" className="h-5 w-5 text-ink-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              go(hits[active]);
            }
          }}
          placeholder="Buscar expedientes, clientes, escritos, leyes… o una acción"
          aria-label="Buscar"
          role="combobox"
          aria-expanded="true"
          aria-controls="busqueda-resultados"
          aria-activedescendant={hits[active] ? `res-${active}` : undefined}
          className="h-14 w-full bg-transparent text-base outline-none placeholder:text-ink-400"
        />
        <kbd className="hidden rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-500 sm:block">Esc</kbd>
      </div>
      <div id="busqueda-resultados" role="listbox" className="max-h-[60vh] overflow-y-auto py-2">
        {groups.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-500">{loading ? "Buscando…" : `Nada coincide con «${q}».`}</p>}
        {groups.map(([name, items]) => (
          <div key={name} className="mb-1">
            <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{name}</p>
            {items.map((h) => (
              <button
                key={`${h.href}-${h.i}`}
                id={`res-${h.i}`}
                role="option"
                aria-selected={h.i === active}
                onMouseEnter={() => setActive(h.i)}
                onClick={() => go(h)}
                className={`flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left text-sm ${h.i === active ? "bg-brand-50 text-ink-900" : "text-ink-700"}`}
              >
                <span className="truncate font-medium">{h.label}</span>
                {h.detail && <span className="shrink-0 truncate text-xs text-ink-500 sm:max-w-[45%]">{h.detail}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="flex gap-3 border-t border-ink-200 px-4 py-2 text-[11px] text-ink-500">
        <span>↑ ↓ para moverte</span>
        <span>Enter para abrir</span>
        <span className="ml-auto">Ctrl K para abrir desde cualquier sitio</span>
      </p>
    </dialog>
  );
}

/** Botón «Buscar… Ctrl K» del menú. */
export function SearchButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={openCommandPalette} className={className}>
      <Icon name="buscar" className="h-4 w-4" />
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="rounded border border-current/30 px-1.5 text-[10px] opacity-70">Ctrl K</kbd>
    </button>
  );
}
