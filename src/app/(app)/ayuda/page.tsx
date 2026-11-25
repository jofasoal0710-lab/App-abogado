import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { GUIDES, TOURS } from "@/lib/help/guides";
import { can } from "@/lib/permissions";
import { HelpCenter } from "./help-center";

export const metadata: Metadata = { title: "Ayuda" };

/** Centro de ayuda: todas las guías por tema, buscador, recorridos guiados y primeros pasos. */
export default async function HelpPage() {
  const user = await requireUser();
  // Solo las guías de lo que la persona puede usar (las de facturación, notaría o administración, con permiso).
  const guides = GUIDES.filter((g) => !g.permission || can(user, g.permission)).map(({ match: _m, ...g }) => g);
  const keys = new Set(guides.map((g) => g.tour).filter(Boolean));
  const tours = TOURS.filter((t) => keys.has(t.key)).map((t) => ({ key: t.key, title: t.title, path: t.path, steps: t.steps.length }));
  return (
    <>
      <PageHeader title="Ayuda" subtitle="Cómo se usa cada parte de la aplicación, con pasos, trucos, preguntas frecuentes y recorridos guiados." />
      <HelpCenter guides={guides} tours={tours} />
    </>
  );
}
