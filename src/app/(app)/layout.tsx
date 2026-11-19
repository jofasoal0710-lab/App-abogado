import Link from "next/link";
import { Icon } from "@/components/icons";
import { Nav, type NavItem } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { roleLabels } from "@/lib/labels";
import { logoutAction } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const items: NavItem[] = [
    { href: "/", label: "Panel", icon: "panel" },
    { href: "/expedientes", label: "Expedientes", icon: "expedientes" },
    { href: "/clientes", label: "Clientes", icon: "clientes" },
    { href: "/agenda", label: "Agenda y plazos", icon: "agenda" },
    { href: "/documentos", label: "Documentos", icon: "documentos" },
    { href: "/horas", label: "Horas", icon: "horas" },
    { href: "/facturas", label: "Facturas", icon: "facturas" },
    ...(user.role === "admin"
      ? ([
          { href: "/recordatorios", label: "Recordatorios", icon: "recordatorios" },
          { href: "/equipo", label: "Equipo", icon: "equipo" },
          { href: "/seguridad", label: "Seguridad", icon: "seguridad" },
        ] satisfies NavItem[])
      : []),
    { href: "/cuenta", label: "Mi cuenta", icon: "cuenta" },
  ];

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print flex shrink-0 flex-col bg-brand-700 pb-3 pt-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:pb-5 lg:pt-6">
        <Link href="/" className="mx-3 mb-3 flex items-center gap-3 rounded-lg px-3 py-1 text-white focus-visible:outline-2 focus-visible:outline-white lg:mb-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-700">
            <Icon name="balanza" className="h-5 w-5" />
          </span>
          <span className="font-serif text-base font-semibold leading-tight">{config.firmName}</span>
        </Link>
        <div className="max-lg:overflow-x-auto max-lg:pb-1">
          <Nav items={items} />
        </div>
        <div className="mx-3 mt-auto hidden items-center gap-3 rounded-lg bg-brand-800/60 px-3 py-3 lg:flex">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white" aria-hidden="true">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <Link href="/cuenta" className="block truncate text-sm font-medium text-white hover:underline">
              {user.name}
            </Link>
            <p className="text-xs text-brand-200">{roleLabels[user.role]}</p>
          </div>
          <form action={logoutAction}>
            <button className="rounded-md p-1.5 text-brand-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white" title="Cerrar sesión">
              <Icon name="salir" className="h-5 w-5" />
              <span className="sr-only">Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="no-print flex items-center justify-end gap-3 border-b border-ink-200 bg-white px-4 py-2 text-sm lg:hidden">
          <Link href="/cuenta" className="text-ink-600 hover:underline">
            {user.name}
          </Link>
          <form action={logoutAction}>
            <button className="link">Cerrar sesión</button>
          </form>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
