"use client";

import { useState } from "react";
import { FeeGuideButton } from "@/components/fee-guide";

/** Tarifa por hora con la guía de tarifas (tarifario del despacho y mínimo del arancel) como ayuda. */
export function RateInput({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div>
      <input className="input" name="rate" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
      <FeeGuideButton only="hora" label="Guía" onPick={(p) => setValue(String(Math.round(p.cents / 100)))} />
    </div>
  );
}
