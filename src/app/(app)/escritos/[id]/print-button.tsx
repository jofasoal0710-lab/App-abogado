"use client";

/** Imprimir o guardar como PDF desde el navegador (el menú y los botones no salen en papel). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary">
      Imprimir / PDF
    </button>
  );
}
