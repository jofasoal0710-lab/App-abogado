import { ordinalLabel, type Block } from "@/lib/forms/engine";

/** Documento redactado, con formato de escrito (letra con serifa, justificado, interlineado amplio). */
export function LegalDocument({ blocks }: { blocks: Block[] }) {
  return (
    <article className="paper legal-doc mx-auto max-w-[46rem] bg-white px-6 py-10 font-serif text-[17px] leading-[1.9] text-ink-900 sm:px-14">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "titulo":
            return (
              <h2 key={i} className="mb-1 text-center text-lg font-semibold">
                {b.text}
              </h2>
            );
          case "encabezado":
            return (
              <p key={i} className="font-semibold">
                {b.text}
              </p>
            );
          case "seccion":
            return (
              <h3 key={i} className="mt-6 font-semibold">
                {b.text}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="mt-4 text-justify">
                {b.text}
              </p>
            );
          case "ordinales":
            return (
              <ol key={i} className="mt-3 space-y-3">
                {b.items.map((it, j) => (
                  <li key={j} className="text-justify">
                    <span className="font-semibold">{ordinalLabel(j, b.prefix)}:</span> {it}
                  </li>
                ))}
              </ol>
            );
          case "firma":
            return (
              <div key={i} className="mt-14 text-center">
                {b.lines.map((l, j) => (l ? <p key={j}>{l}</p> : <div key={j} className="mx-auto my-6 w-64 border-t border-ink-400" />))}
              </div>
            );
        }
      })}
    </article>
  );
}
