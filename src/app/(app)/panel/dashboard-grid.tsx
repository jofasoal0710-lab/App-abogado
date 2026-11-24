"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SIZE_LABELS, moveItem, type LayoutItem, type WidgetSize } from "@/lib/dashboard-widgets";
import { resetDashboardAction, saveDashboardLayoutAction } from "./actions";

export type GridWidget = { id: LayoutItem["id"]; size: WidgetSize; title: string; sizes: WidgetSize[]; node: React.ReactNode };
export type CatalogWidget = { id: LayoutItem["id"]; title: string; description: string; icon: IconName; defaultSize: WidgetSize };

const SPAN: Record<WidgetSize, string> = { s: "md:col-span-1 lg:col-span-1", m: "md:col-span-2 lg:col-span-2", l: "md:col-span-2 lg:col-span-3" };

/**
 * Cuadrícula del panel. En «Personalizar» cada widget muestra controles para moverlo (arrastrando o con
 * ↑ ↓), cambiar su tamaño o quitarlo, y abajo aparece el catálogo para añadir otros. Cada cambio se guarda
 * al momento; al añadir un widget se recarga para traer sus datos del servidor.
 */
export function DashboardGrid({ widgets, catalog }: { widgets: GridWidget[]; catalog: CatalogWidget[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(widgets);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [synced, setSynced] = useState(widgets);
  // Si el servidor trae otra disposición (p. ej. tras añadir un widget), se adopta.
  if (synced !== widgets) {
    setSynced(widgets);
    setItems(widgets);
  }

  const save = (next: GridWidget[], refresh = false) => {
    setItems(next);
    start(async () => {
      await saveDashboardLayoutAction(next.map(({ id, size }) => ({ id, size })));
      if (refresh) router.refresh();
    });
  };
  const add = (w: CatalogWidget) => save([...items, { id: w.id, size: w.defaultSize, title: w.title, sizes: [w.defaultSize], node: null }], true);
  const available = catalog.filter((c) => !items.some((i) => i.id === c.id));

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
        {pending && <span className="text-xs text-ink-500">Guardando…</span>}
        {editing && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() =>
              start(async () => {
                await resetDashboardAction();
                router.refresh();
              })
            }
          >
            Restaurar el panel original
          </button>
        )}
        <button type="button" className={editing ? "btn-primary btn-sm" : "btn-secondary btn-sm"} onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
          {editing ? "Listo" : "Personalizar panel"}
        </button>
      </div>

      {editing && (
        <p className="no-print mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-900">
          Arrastra los widgets (o usa ↑ ↓) para ordenarlos, cambia su tamaño o quítalos con ✕. Abajo puedes añadir otros. Los cambios se guardan solos y solo afectan a tu panel.
        </p>
      )}

      {items.length === 0 && !editing && (
        <div className="card card-pad text-center text-sm text-ink-600">
          Tu panel está vacío.{" "}
          <button type="button" className="link" onClick={() => setEditing(true)}>
            Añade widgets
          </button>
          .
        </div>
      )}

      <div className="grid grid-flow-row-dense gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((w, i) => (
          <div
            key={w.id}
            data-widget={w.id}
            className={`relative ${SPAN[w.size]} ${editing ? "rounded-2xl ring-2 ring-dashed ring-brand-300 ring-offset-4 ring-offset-transparent" : ""} ${dragId === w.id ? "opacity-40" : ""}`}
            draggable={editing}
            onDragStart={(e) => {
              setDragId(w.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => editing && dragId && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = items.findIndex((x) => x.id === dragId);
              if (from >= 0) save(moveItem(items, from, i));
              setDragId(null);
            }}
          >
            {editing && (
              <div className="no-print absolute -top-3 right-3 z-10 flex items-center gap-1 rounded-full border border-ink-200 bg-white px-1.5 py-1 shadow-md">
                <span className="cursor-grab px-1 text-ink-400" title="Arrastrar" aria-hidden>
                  ⠿
                </span>
                <span className="max-w-32 truncate px-1 text-xs font-medium text-ink-700">{w.title}</span>
                <button type="button" className="rounded px-1.5 text-sm hover:bg-ink-100 disabled:opacity-30" disabled={i === 0} onClick={() => save(moveItem(items, i, i - 1))} aria-label={`Subir «${w.title}»`}>
                  ↑
                </button>
                <button type="button" className="rounded px-1.5 text-sm hover:bg-ink-100 disabled:opacity-30" disabled={i === items.length - 1} onClick={() => save(moveItem(items, i, i + 1))} aria-label={`Bajar «${w.title}»`}>
                  ↓
                </button>
                {w.sizes.length > 1 && (
                  <select
                    className="rounded border-0 bg-transparent py-0 pl-1 pr-6 text-xs"
                    value={w.size}
                    onChange={(e) => save(items.map((x) => (x.id === w.id ? { ...x, size: e.target.value as WidgetSize } : x)))}
                    aria-label={`Tamaño de «${w.title}»`}
                  >
                    {w.sizes.map((s) => (
                      <option key={s} value={s}>
                        {SIZE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" className="rounded px-1.5 text-sm text-red-600 hover:bg-red-50" onClick={() => save(items.filter((x) => x.id !== w.id))} aria-label={`Quitar «${w.title}»`}>
                  ✕
                </button>
              </div>
            )}
            <div className={`h-full ${editing ? "pointer-events-none select-none" : ""}`} aria-hidden={editing || undefined}>
              {w.node ?? <div className="card card-pad h-40 animate-pulse text-sm text-ink-400">Cargando {w.title}…</div>}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <section className="no-print mt-8" aria-label="Añadir widgets">
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink-900">Añadir widgets</h2>
          {available.length === 0 ? (
            <p className="text-sm text-ink-500">Ya tienes todos los widgets en tu panel.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((w) => (
                <li key={w.id} className="flex gap-3 rounded-xl border border-dashed border-ink-300 bg-white p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon name={w.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink-900">{w.title}</span>
                    <span className="block text-xs text-ink-500">{w.description}</span>
                  </span>
                  <button type="button" className="btn-secondary btn-sm self-center" onClick={() => add(w)} aria-label={`Añadir «${w.title}»`}>
                    + Añadir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
