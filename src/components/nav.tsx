"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export type NavItem = { href: string; label: string; icon: IconName; /** Otras rutas que cuentan como esta sección. */ also?: string[] };

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 px-3 lg:block lg:space-y-1" aria-label="Principal">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : [item.href, ...(item.also ?? [])].some((h) => pathname.startsWith(h));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-side-fg ${
              active ? "bg-side-active text-side-active-fg shadow-sm" : "text-side-muted hover:bg-side-hover hover:text-side-fg"
            }`}
          >
            <Icon name={item.icon} className={`h-5 w-5 ${active ? "text-side-active-fg" : "text-side-muted"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
