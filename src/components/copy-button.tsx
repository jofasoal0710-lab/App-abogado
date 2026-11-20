"use client";

import { useState } from "react";

/** Copia un texto al portapapeles (para pegarlo en plataformas externas sin conexión directa, como INDEX). */
export function CopyButton({ text, label = "Copiar", className = "btn-ghost btn-sm" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2500);
        } catch {
          /* sin permiso para el portapapeles */
        }
      }}
    >
      <span aria-live="polite">{done ? "Copiado" : label}</span>
    </button>
  );
}
