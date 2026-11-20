"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PALETTES, SIDEBARS, THEME_MODES, type Theme } from "@/lib/theme";
import { saveAppearanceAction } from "./theme-actions";

/** Apariencia: se ve el cambio al momento (en esta página) y se guarda en la cuenta al pulsar «Guardar». */
export function AppearanceForm({ current }: { current: Theme }) {
  const [state, action, pending] = useActionState(saveAppearanceAction, {});
  const [t, setT] = useState<Theme>(current);
  const saved = useRef(current);

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = t.mode;
    el.dataset.palette = t.palette;
    el.dataset.sidebar = t.sidebar;
  }, [t]);
  useEffect(() => {
    if (state?.ok) saved.current = t;
  }, [state, t]);
  // Si se sale sin guardar, se vuelve a la apariencia guardada.
  useEffect(
    () => () => {
      const el = document.documentElement;
      el.dataset.theme = saved.current.mode;
      el.dataset.palette = saved.current.palette;
      el.dataset.sidebar = saved.current.sidebar;
    },
    [],
  );

  return (
    <form action={action} className="space-y-5">
      <fieldset>
        <legend className="label">Modo</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(THEME_MODES) as Theme["mode"][]).map((m) => (
            <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${t.mode === m ? "border-brand-500 bg-brand-50 font-medium" : "border-ink-200 hover:bg-ink-50"}`}>
              <input type="radio" name="mode" value={m} checked={t.mode === m} onChange={() => setT({ ...t, mode: m })} className="accent-brand-600" />
              {THEME_MODES[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Paleta de colores</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(PALETTES) as Theme["palette"][]).map((p) => (
            <label key={p} className={`cursor-pointer rounded-lg border p-2.5 text-sm ${t.palette === p ? "border-brand-500 ring-2 ring-brand-500/30" : "border-ink-200 hover:bg-ink-50"}`}>
              <input type="radio" name="palette" value={p} checked={t.palette === p} onChange={() => setT({ ...t, palette: p })} className="sr-only" />
              <span className="mb-2 flex h-8 overflow-hidden rounded-md" aria-hidden="true">
                {PALETTES[p].swatch.map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              <span className={t.palette === p ? "font-medium" : ""}>{PALETTES[p].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Barra lateral (menú)</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(SIDEBARS) as Theme["sidebar"][]).map((s) => (
            <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${t.sidebar === s ? "border-brand-500 bg-brand-50 font-medium" : "border-ink-200 hover:bg-ink-50"}`}>
              <input type="radio" name="sidebar" value={s} checked={t.sidebar === s} onChange={() => setT({ ...t, sidebar: s })} className="accent-brand-600" />
              {SIDEBARS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar apariencia"}
        </button>
        <span className="text-xs text-ink-500">Ves el cambio al momento; se guarda en tu cuenta y se aplica en cualquier dispositivo.</span>
        {state?.ok && (
          <span role="status" className="text-sm text-emerald-700">
            {state.ok}
          </span>
        )}
      </div>
    </form>
  );
}
