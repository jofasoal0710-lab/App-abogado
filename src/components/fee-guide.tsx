"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { crc, ARANCEL, ARANCEL_AREAS, ARANCEL_SOURCE, arancelMinimum, searchArancel, type ArancelArea } from "@/lib/arancel";
import { FEE_MODE_LABELS, suggestFee } from "@/lib/fees";
import { parseMoneyToCents } from "@/lib/money";
import type { GuideData } from "@/lib/tariff";

export type FeePick = { cents: number; perHour: boolean; serviceId?: number; arancelKey?: string; baseCents: number | null };

/**
 * Botón «Guía de tarifas» (ⓘ): abre una ventana con el tarifario del despacho y el arancel oficial,
 * calcula con la cuantía y, si se indica `onPick`, permite usar un monto en el formulario.
 */
export function FeeGuideButton({
  onPick,
  only,
  initialBaseCents = null,
  label = "Guía de tarifas",
}: {
  onPick?: (p: FeePick) => void;
  /** «hora»: solo tarifas por hora; «total»: solo montos por proceso. */
  only?: "hora" | "total";
  initialBaseCents?: number | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost btn-sm gap-1 text-brand-700" onClick={() => setOpen(true)} aria-haspopup="dialog" title="Ver la tabla de tarifas como guía">
        <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-bold">
          i
        </span>
        {label}
      </button>
      {/* En un portal: fuera del formulario (Enter no lo envía) y de cualquier <label>. */}
      {open && createPortal(<FeeGuideDialog onClose={() => setOpen(false)} onPick={onPick} only={only} initialBaseCents={initialBaseCents} />, document.body)}
    </>
  );
}

function FeeGuideDialog({
  onClose,
  onPick,
  only,
  initialBaseCents,
}: {
  onClose: () => void;
  onPick?: (p: FeePick) => void;
  only?: "hora" | "total";
  initialBaseCents: number | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<GuideData | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"despacho" | "arancel">("despacho");
  const [query, setQuery] = useState("");
  const [baseText, setBaseText] = useState(initialBaseCents ? String(Math.round(initialBaseCents / 100)) : "");
  const [area, setArea] = useState<ArancelArea | "">("");

  useEffect(() => {
    ref.current?.showModal();
    fetch("/api/tarifas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: GuideData) => {
        setData(d);
        if (!d.services.length) setTab("arancel");
      })
      .catch(() => setFailed(true));
  }, []);

  const baseCents = baseText.trim() ? parseMoneyToCents(baseText) : null;
  const adjustBp = data?.adjustBp ?? 0;
  const q = query.trim().toLowerCase();

  const services = useMemo(() => {
    const list = (data?.services ?? []).filter((s) => !q || `${s.name} ${s.description ?? ""}`.toLowerCase().includes(q));
    return list
      .map((s) => ({ s, sug: suggestFee(s, baseCents, adjustBp) }))
      .filter(({ sug }) => !only || (only === "hora" ? sug.perHour : !sug.perHour));
  }, [data, q, baseCents, adjustBp, only]);

  const arancel = useMemo(() => {
    const found = q ? searchArancel(q, 50) : ARANCEL;
    const list = q && !found.length ? ARANCEL.filter((i) => i.name.toLowerCase().includes(q)) : found;
    return list
      .filter((i) => !area || i.area === area)
      .map((i) => ({ i, r: arancelMinimum(i, baseCents, adjustBp) }))
      .filter(({ r }) => !only || (only === "hora" ? !!r.perHour : !r.perHour));
  }, [q, area, baseCents, adjustBp, only]);

  const pick = (p: FeePick) => {
    onPick?.(p);
    ref.current?.close();
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-label="Guía de tarifas" className="m-auto max-h-[92vh] w-[min(60rem,96vw)] rounded-xl bg-surface p-0 text-ink-900 backdrop:bg-ink-900/50">
      <div className="sticky top-0 z-10 space-y-3 border-b border-ink-100 bg-surface px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-serif text-lg font-semibold">Guía de tarifas</p>
            <p className="text-xs text-ink-500">Es una guía: el monto lo decides tú. Los honorarios no pueden ser inferiores a los mínimos del arancel (art. 5).</p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => ref.current?.close()}>
            Cerrar
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-sm sm:col-span-1">
            <span className="label">Cuantía o valor del acto (₡)</span>
            <input className="input" value={baseText} onChange={(e) => setBaseText(e.target.value)} inputMode="decimal" placeholder="p. ej. 20.000.000" aria-label="Cuantía o valor del acto" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="label">Buscar</span>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="traspaso, sociedad, divorcio, laboral…" aria-label="Buscar en la guía" />
          </label>
        </div>
        {baseText.trim() && baseCents === null && <p className="text-xs text-red-700">La cuantía no es un importe válido.</p>}
        <div className="flex gap-1" role="tablist">
          {(
            [
              ["despacho", `Tarifario del despacho${data ? ` (${data.services.length})` : ""}`],
              ["arancel", "Arancel oficial"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"}`}>
              {l}
            </button>
          ))}
          {tab === "arancel" && (
            <select className="input ml-auto w-auto py-1 text-sm" value={area} onChange={(e) => setArea(e.target.value as ArancelArea | "")} aria-label="Filtrar por área">
              <option value="">Todas las áreas</option>
              {Object.entries(ARANCEL_AREAS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {failed && <p className="text-sm text-red-700">No se pudo cargar el tarifario del despacho. El arancel oficial sí está disponible.</p>}
        {tab === "despacho" &&
          (!data ? (
            <p className="text-sm text-ink-500">{failed ? "" : "Cargando…"}</p>
          ) : services.length === 0 ? (
            <p className="text-sm text-ink-500">{data.services.length ? "Ningún servicio coincide." : "El despacho aún no tiene servicios en su tarifario. Puedes crearlos en Facturación → Tarifario."}</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {services.map(({ s, sug }) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-ink-500">
                      {FEE_MODE_LABELS[s.mode]}
                      {s.stages.length ? ` · se cobra en ${s.stages.length} etapas` : ""}
                    </p>
                    <p className="mt-1 text-sm text-ink-700">{sug.explanation}</p>
                    {sug.arancel && <p className="text-xs text-ink-500">Arancel: {sug.arancel.explanation}</p>}
                    {sug.belowArancel && <p className="mt-1 text-xs font-medium text-red-700">⚠ Por debajo del mínimo del arancel.</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{sug.amountCents != null ? `${crc(sug.amountCents)}${sug.perHour ? "/h" : ""}` : "—"}</p>
                    {onPick && sug.amountCents != null && (
                      <button type="button" className="btn-primary btn-sm mt-1" onClick={() => pick({ cents: sug.amountCents!, perHour: sug.perHour, serviceId: s.id, arancelKey: s.arancelKey ?? undefined, baseCents })}>
                        Usar este monto
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === "arancel" && (
          <>
            <ul className="divide-y divide-ink-100">
              {arancel.map(({ i, r }) => (
                <li key={i.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-ink-500">
                      {ARANCEL_AREAS[i.area]} · {i.article}
                      {i.stages ? ` · pago: ${i.stages.map((s) => `${s.name.toLowerCase()} ${Math.round(s.percent)} %`).join(", ")}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-ink-700">{r.explanation}</p>
                    {i.note && <p className="text-xs text-ink-500">{i.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">
                      {r.minCents != null && (!r.needsBase || baseCents) ? `${r.maxCents ? "desde " : ""}${crc(r.minCents)}${r.perHour ? "/h" : ""}` : "—"}
                    </p>
                    {r.maxCents && <p className="text-xs text-ink-500">hasta {crc(r.maxCents)}</p>}
                    {onPick && r.minCents != null && (!r.needsBase || baseCents) && (
                      <button type="button" className="btn-secondary btn-sm mt-1" onClick={() => pick({ cents: r.minCents!, perHour: !!r.perHour, arancelKey: i.key, baseCents })}>
                        Usar el mínimo
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-500">
              Fuente: {ARANCEL_SOURCE.decree}, {ARANCEL_SOURCE.version}.{" "}
              <a className="link" href={ARANCEL_SOURCE.url} target="_blank" rel="noopener noreferrer">
                Ver en SINALEVI
              </a>
              . {ARANCEL_SOURCE.note} Los montos son los del texto del decreto; el Colegio de Abogados los actualiza cada dos años según el IPC (art. 112).
              {adjustBp ? ` Se aplica la actualización del ${adjustBp / 100} % indicada por el despacho${data?.adjustNote ? ` (${data.adjustNote})` : ""}.` : " Si hay una actualización publicada, regístrala en el Tarifario."}
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
