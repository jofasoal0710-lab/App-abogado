"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { searchGuides, type Guide } from "@/lib/help/guides";
import { resetToursAction } from "./actions";

type G = Omit<Guide, "match">;
type T = { key: string; title: string; path: string; steps: number };

const GROUPS: Guide["group"][] = ["Primeros pasos", "Trabajo diario", "Escritos y documentos", "Consulta", "Notaría", "Facturación", "Administración"];

const FIRST_STEPS = [
  { text: "Haz el recorrido de bienvenida (un minuto).", href: "/?tour=bienvenida" },
  { text: "Activa la verificación en dos pasos en «Mi cuenta».", href: "/cuenta" },
  { text: "Da de alta a tu primer cliente (con «Buscar en Hacienda»).", href: "/clientes/nuevo" },
  { text: "Abre su expediente y aplica una plantilla de proceso.", href: "/expedientes/nuevo" },
  { text: "Genera el primer escrito con los datos ya rellenos.", href: "/formularios" },
  { text: "Registra horas o prueba el cronómetro.", href: "/horas" },
  { text: "Personaliza tu panel con los widgets que más uses.", href: "/" },
  { text: "Pídele algo al asistente: «crea una tarea para mañana: …».", href: null },
];

export function HelpCenter({ guides, tours }: { guides: G[]; tours: T[] }) {
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const results = useMemo(() => (q.trim().length >= 3 ? searchGuides(q, guides as Guide[]) : null), [q, guides]);
  const tourOf = (k?: string) => tours.find((t) => t.key === k);

  const card = (g: G, match?: string) => {
    const open = openKey === g.key;
    const tour = tourOf(g.tour);
    return (
      <article key={g.key} className="card" aria-labelledby={`g-${g.key}`}>
        <button type="button" className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left" onClick={() => setOpenKey(open ? null : g.key)} aria-expanded={open}>
          <span>
            <span id={`g-${g.key}`} className="block font-semibold text-ink-900">
              {g.title}
            </span>
            <span className="mt-0.5 block text-sm text-ink-600">{g.summary}</span>
            {match && <span className="mt-1 block text-xs font-medium text-brand-700">→ {match}</span>}
          </span>
          <span aria-hidden className="text-ink-400">{open ? "−" : "+"}</span>
        </button>
        {open && (
          <div className="space-y-4 border-t border-ink-100 px-5 py-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {g.href && (
                <Link href={g.href} className="btn-secondary btn-sm">
                  Ir a {g.title}
                </Link>
              )}
              {tour && (
                <Link href={tour.key === "expediente" ? "/expedientes" : `${tour.path}?tour=${tour.key}`} className="btn-primary btn-sm">
                  ▶ {tour.key === "expediente" ? "Abre un expediente y pulsa «?» para el recorrido" : `Ver el recorrido (${tour.steps} pasos)`}
                </Link>
              )}
            </div>
            {g.howTo.map((h) => (
              <div key={h.title}>
                <h3 className="font-medium text-ink-900">{h.title}</h3>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink-700">
                  {h.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
            {g.tips?.length ? (
              <ul className="space-y-1.5">
                {g.tips.map((t) => (
                  <li key={t} className="rounded-lg bg-brand-50 px-3 py-2 text-brand-900">
                    💡 {t}
                  </li>
                ))}
              </ul>
            ) : null}
            {g.faq?.length ? (
              <dl className="space-y-2">
                {g.faq.map((f) => (
                  <div key={f.q}>
                    <dt className="font-medium text-ink-900">{f.q}</dt>
                    <dd className="text-ink-700">{f.a}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="space-y-8">
      <div className="card card-pad">
        <label className="block">
          <span className="label">¿Qué quieres hacer?</span>
          <input className="input text-base" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Por ejemplo: emitir una factura, cronómetro, dos pasos, portal del cliente…" autoFocus />
        </label>
        <p className="hint mt-1">También puedes pulsar el botón «?» junto al título de cualquier pantalla para ver su ayuda.</p>
      </div>

      {results ? (
        <section aria-label="Resultados de la búsqueda" className="space-y-3">
          {results.length ? results.slice(0, 8).map((r) => card(r.guide, r.match)) : <p className="text-sm text-ink-600">No encontré nada sobre «{q}». Prueba con otras palabras o pregúntale al asistente.</p>}
        </section>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card card-pad" aria-labelledby="primeros">
              <h2 id="primeros" className="font-serif text-lg font-semibold">Primeros pasos</h2>
              <ol className="mt-3 space-y-2 text-sm">
                {FIRST_STEPS.map((s, i) => (
                  <li key={s.text} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{i + 1}</span>
                    {s.href ? (
                      <Link href={s.href} className="link">
                        {s.text}
                      </Link>
                    ) : (
                      <span>{s.text}</span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
            <section className="card card-pad" aria-labelledby="recorridos">
              <h2 id="recorridos" className="font-serif text-lg font-semibold">Recorridos guiados</h2>
              <p className="mt-1 text-sm text-ink-600">Te llevan a la pantalla y señalan cada parte, paso a paso.</p>
              <ul className="mt-3 divide-y divide-ink-100 text-sm">
                {tours.map((t) => (
                  <li key={t.key} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {t.title} <span className="text-xs text-ink-500">· {t.steps} pasos</span>
                    </span>
                    {t.key === "expediente" ? (
                      <span className="text-xs text-ink-500">Desde un expediente, botón «?»</span>
                    ) : (
                      <Link href={`${t.path}?tour=${t.key}`} className="btn-secondary btn-sm">
                        ▶ Empezar
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <form action={resetToursAction} className="mt-2">
                <button className="btn-ghost btn-sm">Volver a mostrar la bienvenida al entrar</button>
              </form>
            </section>
          </div>
          {GROUPS.map((grp) => {
            const list = guides.filter((g) => g.group === grp);
            if (!list.length) return null;
            return (
              <section key={grp} aria-labelledby={`grp-${grp}`} className="space-y-3">
                <h2 id={`grp-${grp}`} className="font-serif text-xl font-semibold">{grp}</h2>
                {list.map((g) => card(g))}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
