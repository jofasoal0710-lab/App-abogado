import { CopyButton } from "@/components/copy-button";

/** Fragmento de búsqueda con las coincidencias («[[…]]») resaltadas, sin HTML de terceros. */
export function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\[\[.*?\]\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[[") && p.endsWith("]]") ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-ink-900">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Cuerpo de un artículo: párrafos, y las notas de reforma («(Así reformado…)») en gris. */
export function ArticleBody({ body }: { body: string }) {
  const paras = body.split(/\n{2,}|\n(?=\()/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-2 text-[15px] leading-relaxed text-ink-800">
      {paras.map((p, i) =>
        /^\((Así|Esta ley|El nombre|Derogado|\*)/i.test(p) ? (
          <p key={i} className="text-xs text-ink-500">
            {p}
          </p>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ),
      )}
    </div>
  );
}

export function articleLabel(number: string) {
  return /^[IVXLCDM]+$/.test(number) ? `Artículo ${number} (disposiciones finales)` : `Artículo ${number}`;
}

export function ArticleCard({ a, lawTitle, citeHref }: { a: { number: string; heading: string | null; body: string }; lawTitle: string; citeHref: string }) {
  const id = `art-${a.number.replace(/\s+/g, "-")}`;
  const plain = `${articleLabel(a.number)} del ${lawTitle}.\n${a.body.replace(/\n{2,}/g, "\n")}`;
  return (
    <article id={id} className="scroll-mt-24 border-b border-ink-100 px-5 py-4 last:border-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-base font-semibold text-ink-900">
          <a href={`#${id}`} className="hover:underline">
            {articleLabel(a.number)}
          </a>
        </h3>
        <div className="no-print flex gap-1">
          <CopyButton text={plain} label="Copiar" />
          <a className="btn-ghost btn-sm" href={citeHref}>
            Citar en expediente
          </a>
        </div>
      </div>
      <ArticleBody body={a.body} />
    </article>
  );
}
