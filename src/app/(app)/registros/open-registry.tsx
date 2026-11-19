"use client";

import { useState } from "react";

/**
 * Abre la consulta oficial en otra pestaña y deja copiada la referencia (cédula, finca, placa…) para
 * pegarla allí. Los registros no permiten rellenarla desde fuera.
 */
export function OpenRegistry({ url, label, reference }: { url: string; label: string; reference: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={async () => {
        if (!reference) return;
        try {
          await navigator.clipboard.writeText(reference);
          setCopied(true);
          setTimeout(() => setCopied(false), 4000);
        } catch {
          /* sin permiso para el portapapeles: se abre igualmente */
        }
      }}
      className="btn-secondary btn-sm"
    >
      {copied ? `Copiado ${reference}: pégalo allí` : label}
    </a>
  );
}
