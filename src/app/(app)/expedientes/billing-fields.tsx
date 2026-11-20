"use client";

import { useState } from "react";
import { FeeGuideButton } from "@/components/fee-guide";
import { crc, arancelItem, arancelMinimum } from "@/lib/arancel";
import { FEE_MODE_LABELS, suggestFee } from "@/lib/fees";
import { parseMoneyToCents } from "@/lib/money";
import type { GuideService } from "@/lib/tariff";

const toText = (cents: number | null | undefined) => (cents != null ? String(Math.round(cents / 100)) : "");

/** Cómo se cobra el expediente: por horas o por proceso, con el tarifario y el arancel como guía. */
export function BillingFields({
  services,
  adjustBp,
  initial,
}: {
  services: GuideService[];
  adjustBp: number;
  initial: {
    billingType: "por_horas" | "tarifa_fija";
    serviceId: number | null;
    feeBaseCents: number | null;
    fixedFeeCents: number | null;
    hourlyRateCents: number | null;
  };
}) {
  const [billingType, setBillingType] = useState(initial.billingType);
  const [serviceId, setServiceId] = useState(initial.serviceId ? String(initial.serviceId) : "");
  const [baseText, setBaseText] = useState(toText(initial.feeBaseCents));
  const [feeText, setFeeText] = useState(toText(initial.fixedFeeCents));
  const [rateText, setRateText] = useState(toText(initial.hourlyRateCents));
  const [arancelKey, setArancelKey] = useState<string | null>(null);

  const service = services.find((s) => String(s.id) === serviceId) ?? null;
  const baseCents = baseText.trim() ? parseMoneyToCents(baseText) : null;
  const sug = service ? suggestFee(service, baseCents, adjustBp) : null;
  const refKey = service?.arancelKey ?? arancelKey;
  const ref = arancelItem(refKey);
  const arancel = ref ? arancelMinimum(ref, baseCents, adjustBp) : null;
  const perProcess = billingType === "tarifa_fija";
  const typed = perProcess ? (feeText.trim() ? parseMoneyToCents(feeText) : null) : rateText.trim() ? parseMoneyToCents(rateText) : null;
  const below = typed != null && arancel?.minCents != null && !!arancel.perHour === !perProcess && (!arancel.needsBase || (baseCents ?? 0) > 0) && typed < arancel.minCents;
  const hourMin = arancelMinimum(arancelItem("hora")!, null, adjustBp).minCents!;
  const belowHour = !perProcess && typed != null && typed > 0 && typed < hourMin;

  const chooseService = (id: string) => {
    setServiceId(id);
    const s = services.find((x) => String(x.id) === id);
    if (!s) return;
    const g = suggestFee(s, baseCents, adjustBp);
    if (g.perHour) {
      setBillingType("por_horas");
      if (g.amountCents) setRateText(toText(g.amountCents));
    } else {
      setBillingType("tarifa_fija");
      if (g.amountCents) setFeeText(toText(g.amountCents));
    }
  };

  return (
    <fieldset className="space-y-4 rounded-lg border border-ink-200 p-4 sm:col-span-2">
      <legend className="px-1 text-sm font-semibold text-ink-800">Cobro de honorarios</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="radiogroup" aria-label="Modalidad de honorarios">
          {(
            [
              ["tarifa_fija", "Por proceso (monto total)"],
              ["por_horas", "Por horas"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${billingType === v ? "bg-brand-600 text-white ring-brand-600" : "text-ink-700 ring-ink-200 hover:bg-ink-50"}`}>
              <input type="radio" className="sr-only" name="billingType" value={v} checked={billingType === v} onChange={() => setBillingType(v)} />
              {l}
            </label>
          ))}
        </div>
        <FeeGuideButton
          initialBaseCents={baseCents}
          onPick={(p) => {
            if (p.serviceId) setServiceId(String(p.serviceId));
            setArancelKey(p.arancelKey ?? null);
            if (p.baseCents) setBaseText(toText(p.baseCents));
            if (p.perHour) {
              setBillingType("por_horas");
              setRateText(toText(p.cents));
            } else {
              setBillingType("tarifa_fija");
              setFeeText(toText(p.cents));
            }
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="label">Proceso o servicio (del tarifario)</span>
          <select className="input" name="serviceId" value={serviceId} onChange={(e) => chooseService(e.target.value)}>
            <option value="">— Ninguno —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {FEE_MODE_LABELS[s.mode]}
              </option>
            ))}
          </select>
          {!services.length && <span className="mt-1 block text-xs text-ink-500">Aún no hay servicios: créalos en Facturación → Tarifario, o usa la guía con el arancel.</span>}
        </label>
        <label className="block text-sm">
          <span className="label">Cuantía o valor del acto (₡, si aplica)</span>
          <input className="input" name="feeBase" value={baseText} onChange={(e) => setBaseText(e.target.value)} inputMode="decimal" placeholder="p. ej. 20.000.000" />
        </label>

        {perProcess ? (
          <label className="block text-sm">
            <span className="label">Honorarios del proceso (₡, sin IVA)</span>
            <input className="input" name="fixedFee" value={feeText} onChange={(e) => setFeeText(e.target.value)} inputMode="decimal" required aria-describedby="fee-help" />
          </label>
        ) : (
          <label className="block text-sm">
            <span className="label">Tarifa por hora de este expediente (₡)</span>
            <input className="input" name="hourlyRate" value={rateText} onChange={(e) => setRateText(e.target.value)} inputMode="decimal" placeholder="Si se deja vacío, la de cada abogado" aria-describedby="fee-help" />
          </label>
        )}
        <div id="fee-help" className="text-sm" aria-live="polite">
          {sug && (
            <p className="text-ink-700">
              <span className="font-medium">Sugerido: {sug.amountCents != null ? `${crc(sug.amountCents)}${sug.perHour ? "/h" : ""}` : "—"}</span>
              <span className="block text-xs text-ink-500">{sug.explanation}</span>
              {sug.amountCents != null && sug.perHour === !perProcess && (
                <button type="button" className="link mt-1 text-xs" onClick={() => (perProcess ? setFeeText(toText(sug.amountCents)) : setRateText(toText(sug.amountCents)))}>
                  Usar el sugerido
                </button>
              )}
            </p>
          )}
          {arancel && <p className="mt-1 text-xs text-ink-500">Arancel ({ref!.article}): {arancel.explanation}</p>}
          {!perProcess && !sug && <p className="text-xs text-ink-500">Mínimo del arancel por hora profesional: {crc(hourMin)} (art. 7).</p>}
          {(below || belowHour) && <p className="mt-1 text-xs font-medium text-red-700">⚠ El monto es inferior al mínimo del arancel. Solo es válido si hay causa justificada; revísalo.</p>}
          {perProcess && service?.stages.length ? <p className="mt-1 text-xs text-ink-500">Se cobrará en {service.stages.length} etapas: {service.stages.map((s) => `${s.name} (${s.percent} %)`).join(", ")}.</p> : null}
        </div>
      </div>
      <input type="hidden" name="suggestedFee" value={sug?.amountCents != null && !sug.perHour ? String(sug.amountCents / 100) : ""} />
    </fieldset>
  );
}
