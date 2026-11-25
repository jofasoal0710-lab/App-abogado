import { AssistantChat } from "@/components/assistant-chat";
import { CommandPalette } from "@/components/command-palette";
import { Sidebar, type NavGroup, type NavItem } from "@/components/sidebar";
import { TimerBar } from "@/components/timer/timer-bar";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { can } from "@/lib/permissions";
import { currentTheme } from "@/lib/theme-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const theme = await currentTheme();
  // Tareas abiertas asignadas a mí (y si alguna está vencida) para el contador del menú.
  const [myTasks] = await db
    .select({ open: sql<number>`count(*)::int`, overdue: sql<number>`count(*) filter (where ${events.startsAt} < now())::int` })
    .from(events)
    .where(and(eq(events.kind, "tarea"), eq(events.assignedId, user.id), ne(events.status, "hecha")));

  const groups: NavGroup[] = [
    { title: null, items: [{ href: "/", label: "Panel", icon: "panel" }] },
    {
      title: "Trabajo diario",
      items: [
        { href: "/expedientes", label: "Expedientes", icon: "expedientes" },
        { href: "/clientes", label: "Mis clientes", icon: "clientes" },
        { href: "/agenda", label: "Control de plazos", icon: "agenda" },
        { href: "/tareas", label: "Tareas", icon: "tareas", badge: myTasks?.open || undefined, alert: (myTasks?.overdue ?? 0) > 0 },
        { href: "/horas", label: "Horas", icon: "horas" },
      ],
    },
    {
      title: "Escritos y documentos",
      items: [
        { href: "/formularios", label: "Formularios", icon: "formularios", also: ["/escritos"] },
        { href: "/documentos", label: "Documentos", icon: "documentos" },
      ],
    },
    {
      title: "Consulta",
      items: [
        { href: "/normativa", label: "Normativa", icon: "balanza" },
        { href: "/conocimiento", label: "Conocimiento", icon: "conocimiento" },
        { href: "/herramientas", label: "Herramientas", icon: "calculadora" },
        { href: "/reportes", label: "Reportes", icon: "actividad" },
      ],
    },
    ...(can(user, "notaria.usar") ? [{ title: "Notaría", items: [{ href: "/notaria", label: "Gestor notarial", icon: "notario" }] } satisfies NavGroup] : []),
    ...(can(user, "facturacion.ver") ? [{ title: "Facturación", items: [{ href: "/facturas", label: "Facturas", icon: "facturas" }, { href: "/tarifario", label: "Tarifario", icon: "calculadora" }] } satisfies NavGroup] : []),
    {
      title: "Administración",
      items: [
        ...(can(user, "recordatorios.gestionar") ? [{ href: "/recordatorios", label: "Recordatorios", icon: "recordatorios" } satisfies NavItem] : []),
        ...(can(user, "equipo.gestionar") ? [{ href: "/equipo", label: "Equipo", icon: "equipo" } satisfies NavItem] : []),
        ...(can(user, "seguridad.ver") ? [{ href: "/seguridad", label: "Seguridad", icon: "seguridad" } satisfies NavItem] : []),
        { href: "/cuenta", label: "Mi cuenta", icon: "cuenta" },
      ],
    },
  ];

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar al contenido
      </a>
      <Sidebar groups={groups} firmName={config.firmName} user={{ name: user.name, roleName: user.roleName, initials }} darkMode={theme.mode === "dark"} />
      <div className="min-w-0 flex-1">
        <TimerBar user={user} />
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-24 pt-6 outline-none sm:px-8 sm:py-8">{children}</main>
        <AssistantChat />
        <CommandPalette />
      </div>
    </div>
  );
}
