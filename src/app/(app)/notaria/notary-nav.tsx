import Link from "next/link";

const TABS = [
  ["/notaria", "Protocolo"],
  ["/notaria/indice", "Índice"],
  ["/notaria/testimonios", "Testimonios"],
  ["/notaria/perfil", "Perfil de notario"],
] as const;

/** Pestañas del gestor notarial. */
export function NotaryNav({ current }: { current: (typeof TABS)[number][0] }) {
  return (
    <nav className="no-print mb-6 flex gap-1 overflow-x-auto border-b border-ink-200" aria-label="Gestor notarial">
      {TABS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            current === href ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
