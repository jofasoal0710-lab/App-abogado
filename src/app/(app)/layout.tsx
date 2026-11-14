import { Nav, type NavItem } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { roleLabels } from "@/lib/labels";
import { logoutAction } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const items: NavItem[] = [
    { href: "/", label: "Panel" },
    { href: "/expedientes", label: "Expedientes" },
    { href: "/clientes", label: "Clientes" },
    { href: "/agenda", label: "Agenda y plazos" },
    { href: "/documentos", label: "Documentos" },
    { href: "/horas", label: "Horas" },
    { href: "/facturas", label: "Facturas" },
    ...(user.role === "admin" ? [{ href: "/equipo", label: "Equipo" }] : []),
  ];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print flex shrink-0 flex-col bg-ink-900 py-5 lg:sticky lg:top-0 lg:h-screen lg:w-60">
        <div className="px-6 pb-5">
          <p className="font-serif text-lg font-semibold leading-tight text-white">{config.firmName}</p>
        </div>
        <div className="max-lg:overflow-x-auto">
          <Nav items={items} />
        </div>
        <div className="mt-auto hidden border-t border-white/10 px-6 pt-4 lg:block">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-ink-400">{roleLabels[user.role]}</p>
          <form action={logoutAction} className="mt-3">
            <button className="text-xs font-medium text-ink-300 hover:text-white">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="no-print flex items-center justify-end gap-3 border-b border-ink-200 bg-white px-6 py-2 text-sm lg:hidden">
          <span className="text-ink-600">{user.name}</span>
          <form action={logoutAction}>
            <button className="link">Salir</button>
          </form>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
