/**
 * Iconos de trazo (24×24, 1.75 px), dibujados en SVG dentro de la página: no se carga nada externo,
 * así que la política de seguridad de contenido no cambia. Son decorativos (aria-hidden): cada uno
 * va siempre junto a su texto.
 */
const paths = {
  panel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  expedientes: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M3 11h18" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18.5 14a6.5 6.5 0 0 1 3 6" />
    </>
  ),
  agenda: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17h2" />
    </>
  ),
  documentos: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  horas: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  facturas: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  recordatorios: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  equipo: (
    <>
      <circle cx="12" cy="7.5" r="3" />
      <circle cx="5" cy="10" r="2.2" />
      <circle cx="19" cy="10" r="2.2" />
      <path d="M7 20a5 5 0 0 1 10 0M1.5 19a3.5 3.5 0 0 1 5-3.2M22.5 19a3.5 3.5 0 0 0-5-3.2" />
    </>
  ),
  seguridad: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  cuenta: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  salir: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  balanza: (
    <>
      <path d="M12 3v18M7 21h10M5 7h14" />
      <path d="M5 7 2.5 13a3 3 0 0 0 5 0Z" />
      <path d="M19 7l-2.5 6a3 3 0 0 0 5 0Z" />
    </>
  ),
  euro: (
    <>
      <path d="M17 6.5A6.5 6.5 0 1 0 17 17.5" />
      <path d="M4 10.5h9M4 13.5h9" />
    </>
  ),
  cobro: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  actividad: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  formularios: (
    <>
      <path d="M8 3h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M16 3v4h4M9.5 12h7M9.5 15.5h7M9.5 8.5h3" />
      <path d="M3.5 7v12a2 2 0 0 0 2 2" />
    </>
  ),
  notario: (
    <>
      <path d="M12 3 3 8h18Z" />
      <path d="M5 8v9M9.5 8v9M14.5 8v9M19 8v9M3 20h18" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 3 2 20h20Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  calculadora: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h.01M12 18h.01" />
    </>
  ),
  conocimiento: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z" />
      <path d="M4 21a2 2 0 0 1 2-2h12v2H6M9 8h6M9 12h4" />
    </>
  ),
  subir: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {paths[name]}
    </svg>
  );
}
