"use client";

/** Imprime el reporte (o lo guarda como PDF desde el diálogo de impresión del navegador). */
export function PrintButton() {
  return (
    <button type="button" className="no-print btn-secondary" onClick={() => window.print()}>
      Imprimir o guardar PDF
    </button>
  );
}
