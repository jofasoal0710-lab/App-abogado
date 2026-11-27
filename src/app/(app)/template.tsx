/**
 * Se vuelve a montar en cada navegación: la pantalla nueva entra con un desvanecido y un leve ascenso,
 * para que moverse entre secciones se sienta continuo (ver .page-enter en globals.css).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
