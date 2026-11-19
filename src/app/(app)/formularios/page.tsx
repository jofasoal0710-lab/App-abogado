import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { TEMPLATES } from "@/lib/forms/templates";
import { qs } from "@/lib/search";

export const metadata: Metadata = { title: "Formularios" };

/** Catálogo de formularios: escritos de proceso (abogado) y escrituras (notario). */
export default async function FormsPage({ searchParams }: { searchParams: Promise<{ expediente?: string }> }) {
  await requireUser();
  const exp = (await searchParams).expediente ?? "";
  const groups = [
    { kind: "escrito" as const, title: "Escritos de abogado", subtitle: "Escritos de proceso. Se enlazan al expediente.", action: "Generar escrito", icon: "formularios" as const },
    { kind: "escritura" as const, title: "Escrituras notariales", subtitle: "Instrumentos del protocolo (con tomo, folio y número).", action: "Redactar escritura", icon: "notario" as const },
  ];
  return (
    <>
      <PageHeader title="Formularios" subtitle="Modelos base de Costa Rica: revísalos y adáptalos a cada caso antes de presentarlos." />
      {groups.map((g) => (
        <section key={g.kind} id={g.kind === "escritura" ? "escrituras" : "escritos"} className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Icon name={g.icon} className="h-5 w-5 text-brand-600" />
            <h2 className="font-serif text-xl font-semibold text-ink-900">{g.title}</h2>
          </div>
          <p className="mb-4 text-sm text-ink-600">{g.subtitle}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.filter((t) => t.kind === g.kind).map((t) => (
              <div key={t.key} className="card card-pad flex flex-col">
                <p className="text-xs font-medium text-brand-700">{t.category}</p>
                <h3 className="mt-1 font-medium text-ink-900">{t.title}</h3>
                <p className="mt-1 flex-1 text-sm text-ink-600">{t.description}</p>
                <Link href={`/formularios/${t.key}${qs({ expediente: exp })}`} className="btn-primary btn-sm mt-4 self-start">
                  {g.action}
                </Link>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
