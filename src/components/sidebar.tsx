"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/login/actions";
import { toggleDarkAction } from "@/app/(app)/cuenta/theme-actions";
import { openCommandPalette, SearchButton } from "./command-palette";
import { Icon, type IconName } from "./icons";

export type NavItem = { href: string; label: string; icon: IconName; /** Otras rutas que cuentan como esta sección. */ also?: string[] };
export type NavGroup = { title: string | null; items: NavItem[] };

const STORAGE_KEY = "menu-plegado";

function isActive(pathname: string, item: NavItem) {
  return item.href === "/" ? pathname === "/" : [item.href, ...(item.also ?? [])].some((h) => pathname.startsWith(h));
}

/**
 * Menú principal: secciones plegables (se recuerda lo plegado en este navegador; la sección de la
 * página actual siempre está abierta), búsqueda (Ctrl+K) y, en el móvil, un panel que se abre con ☰.
 */
export function Sidebar({
  groups,
  firmName,
  user,
  darkMode,
}: {
  groups: NavGroup[];
  firmName: string;
  user: { name: string; roleName: string; initials: string };
  darkMode: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")));
    } catch {
      /* sin almacenamiento: todo abierto */
    }
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const toggle = (title: string) => {
    const next = new Set(collapsed);
    if (next.has(title)) next.delete(title);
    else next.add(title);
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* no pasa nada */
    }
  };

  const modeLabel = darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  const iconBtn = "rounded-md p-1.5 text-side-muted hover:bg-side-hover hover:text-side-fg focus-visible:outline-2 focus-visible:outline-side-fg";

  const panel = (
    <>
      <Link href="/" className="mx-3 mb-4 flex items-center gap-3 rounded-lg px-3 py-1 text-side-fg focus-visible:outline-2 focus-visible:outline-side-fg">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white/20">
          <Icon name="balanza" className="h-5 w-5" />
        </span>
        <span className="font-serif text-base font-semibold leading-tight">{firmName}</span>
      </Link>
      <div className="mx-3 mb-3">
        <SearchButton className="flex w-full items-center gap-2 rounded-lg bg-side-hover px-3 py-2 text-sm text-side-muted ring-1 ring-inset ring-current/15 hover:text-side-fg" />
      </div>
      <nav
        aria-label="Principal"
        className="flex-1 space-y-1 overflow-y-auto px-3 pb-3"
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
      >
        {groups.map((g, gi) => {
          const containsActive = g.items.some((it) => isActive(pathname, it));
          const isCollapsed = !!g.title && collapsed.has(g.title) && !containsActive;
          const listId = `menu-${gi}`;
          return (
            <div key={g.title ?? gi} className={g.title ? "pt-2" : ""}>
              {g.title && (
                <button
                  type="button"
                  onClick={() => toggle(g.title!)}
                  aria-expanded={!isCollapsed}
                  aria-controls={listId}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-side-muted hover:text-side-fg"
                >
                  {g.title}
                  <Icon name="flecha" className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                </button>
              )}
              {!isCollapsed && (
                <ul id={listId} className="space-y-0.5">
                  {g.items.map((item) => {
                    const active = isActive(pathname, item);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-side-fg ${
                            active ? "bg-side-active text-side-active-fg shadow-sm" : "text-side-muted hover:bg-side-hover hover:text-side-fg"
                          }`}
                        >
                          <Icon name={item.icon} className={`h-5 w-5 ${active ? "text-side-active-fg" : "text-side-muted"}`} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="mx-3 flex items-center gap-2 rounded-lg bg-side-2 px-3 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white" aria-hidden="true">
          {user.initials}
        </span>
        <div className="min-w-0 flex-1">
          <Link href="/cuenta" className="block truncate text-sm font-medium text-side-fg hover:underline">
            {user.name}
          </Link>
          <p className="truncate text-xs text-side-muted">{user.roleName}</p>
        </div>
        <form action={toggleDarkAction}>
          <button className={iconBtn} title={modeLabel}>
            <Icon name={darkMode ? "sol" : "luna"} className="h-5 w-5" />
            <span className="sr-only">{modeLabel}</span>
          </button>
        </form>
        <form action={logoutAction}>
          <button className={iconBtn} title="Cerrar sesión">
            <Icon name="salir" className="h-5 w-5" />
            <span className="sr-only">Cerrar sesión</span>
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Escritorio: barra lateral fija */}
      <aside className="no-print hidden shrink-0 flex-col border-ink-200 bg-side pb-4 pt-6 [[data-sidebar=clara]_&]:border-r lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64">{panel}</aside>

      {/* Móvil: barra superior con ☰, búsqueda y modo */}
      <div className="no-print sticky top-0 z-30 flex items-center gap-1 border-b border-ink-200 bg-surface px-2 py-1.5 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost" aria-label="Abrir el menú" aria-expanded={open}>
          <Icon name="menu" className="h-6 w-6" />
        </button>
        <Link href="/" className="min-w-0 flex-1 truncate font-serif text-base font-semibold text-ink-900">
          {firmName}
        </Link>
        <button type="button" onClick={openCommandPalette} className="btn-ghost" aria-label="Buscar">
          <Icon name="buscar" className="h-5 w-5" />
        </button>
        <form action={toggleDarkAction}>
          <button className="btn-ghost" aria-label={modeLabel}>
            <Icon name={darkMode ? "sol" : "luna"} className="h-5 w-5" />
          </button>
        </form>
      </div>
      {open && (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" className="absolute inset-0 bg-ink-900/50" aria-label="Cerrar el menú" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[min(18rem,85vw)] flex-col bg-side pb-4 pt-4 shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} className={`absolute right-2 top-2 ${iconBtn}`} aria-label="Cerrar el menú">
              <Icon name="cerrar" className="h-5 w-5" />
            </button>
            {panel}
          </aside>
        </div>
      )}
    </>
  );
}
