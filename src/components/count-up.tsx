"use client";

import { useEffect, useState } from "react";

type Format = "int" | "hm" | "pct" | "money";
type Money = { currency: string; locale: string };

const fmt = (n: number, f: Format, m?: Money) =>
  f === "money" && m
    ? new Intl.NumberFormat(m.locale, { style: "currency", currency: m.currency, useGrouping: "always" }).format(n / 100)
    : f === "hm" ? (n < 60 ? `${n} min` : `${Math.floor(n / 60)} h${n % 60 ? ` ${String(n % 60).padStart(2, "0")}` : ""}`) : f === "pct" ? `${n} %` : n.toLocaleString("es-CR");

/**
 * Cifra que «sube» hasta su valor al aparecer (700 ms, frenando al final). En el servidor y sin JavaScript
 * se ve el valor final; quien prefiere menos movimiento lo ve directamente.
 */
export function CountUp({ value, format = "int", duration = 700, money }: { value: number; format?: Format; duration?: number; money?: Money }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (!value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{fmt(n, format, money)}</span>;
}
