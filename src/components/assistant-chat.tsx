"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { askAssistantAction, executeAssistantAction } from "@/app/(app)/asistente/actions";
import type { AssistantAnswer } from "@/lib/assistant";
import type { ChatContext, Proposal } from "@/lib/assistant-exec";

type Message = ({ from: "yo" } & { text: string }) | ({ from: "asistente"; done?: boolean } & AssistantAnswer);

const START: Message = {
  from: "asistente",
  text: "Hola. Pregúntame por expedientes, clientes, cobros y plazos, o una duda jurídica. También puedo HACER cosas por ti: crear tareas y plazos, agendar audiencias, registrar horas, manejar el cronómetro, añadir notas o cambiar el estado de un expediente (siempre te pido confirmación).",
  suggestions: ["Resumen", "Mis tareas", "Crea una tarea para mañana: revisar contrato", "Plazos de esta semana", "¿Cuánto tengo para apelar una sentencia?"],
};

/** Tarjeta para confirmar una acción: muestra lo entendido y deja corregir cada dato antes de ejecutar. */
function ProposalCard({ proposal, disabled, onConfirm, onCancel }: { proposal: Proposal; disabled: boolean; onConfirm: (cmd: Record<string, string>) => void; onCancel: () => void }) {
  const [cmd, setCmd] = useState<Record<string, string>>(proposal.cmd);
  const set = (k: string, v: string) => setCmd((c) => ({ ...c, [k]: v }));
  const missing = proposal.fields.filter((f) => f.required && !(cmd[f.name] ?? "").trim());
  return (
    <form
      className="mt-2 space-y-2 rounded-xl border border-brand-200 bg-brand-50/60 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!missing.length) onConfirm(cmd);
      }}
      aria-label={proposal.summary}
    >
      <p className="text-xs text-ink-600">
        <span className="font-semibold text-ink-800">Entendí:</span> {proposal.understood.join(" · ")}
      </p>
      {proposal.fields.map((f) => (
        <label key={f.name} className={f.kind === "checkbox" ? "flex items-center gap-2 text-xs font-medium text-ink-700" : "block"}>
          {f.kind !== "checkbox" && <span className="mb-0.5 block text-xs font-medium text-ink-700">{f.label}</span>}
          {f.kind === "select" ? (
            <select className="input py-1.5 text-sm" name={f.name} value={cmd[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.kind === "textarea" ? (
            <textarea className="input min-h-16 py-1.5 text-sm" name={f.name} value={cmd[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
          ) : f.kind === "checkbox" ? (
            <>
              <input type="checkbox" name={f.name} checked={cmd[f.name] === "on"} onChange={(e) => set(f.name, e.target.checked ? "on" : "")} />
              {f.label}
            </>
          ) : (
            <input
              className="input py-1.5 text-sm"
              name={f.name}
              type={f.kind === "date" ? "date" : f.kind === "time" ? "time" : "text"}
              placeholder={f.kind === "duration" ? "1:30" : undefined}
              value={cmd[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
            />
          )}
        </label>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" className="btn-primary btn-sm" disabled={disabled || missing.length > 0} title={missing.length ? `Falta: ${missing.map((f) => f.label).join(", ")}` : undefined}>
          {proposal.confirmLabel}
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={onCancel} disabled={disabled}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Burbuja de chat del asistente: abajo a la derecha en todas las pantallas. */
export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([START]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  // El expediente del que se está hablando («crea una tarea en ese expediente»).
  const [context, setContext] = useState<ChatContext>({});
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // En el móvil el botón se aparta mientras se baja por la página (no tapa lo que se está leyendo) y
  // vuelve al subir o al dejar de desplazarse un momento.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (window.innerWidth >= 640) return setHidden(false);
      const y = window.scrollY;
      if (y > last + 4 && y > 80) setHidden(true);
      else if (y < last - 4) setHidden(false);
      last = y;
      clearTimeout(timer);
      timer = setTimeout(() => setHidden(false), 1200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setMessages((m) => [...m, { from: "yo", text: q }]);
    setInput("");
    startTransition(async () => {
      const res = await askAssistantAction(q, context);
      if (res.context) setContext(res.context);
      setMessages((m) => [...m, { from: "asistente", ...res }]);
    });
  }

  function confirm(index: number, cmd: Record<string, string>) {
    startTransition(async () => {
      const res = await executeAssistantAction(cmd);
      if (res.context) setContext(res.context);
      setMessages((m) => [...m.map((x, i) => (i === index ? { ...x, done: true } : x)), { from: "asistente", ...res }]);
    });
  }
  function cancel(index: number) {
    setMessages((m) => [...m.map((x, i) => (i === index ? { ...x, done: true } : x)), { from: "asistente", text: "Cancelado: no he cambiado nada." }]);
  }

  return (
    <div
      className={`no-print fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-3 transition-transform duration-200 sm:bottom-6 sm:right-6 ${hidden && !open ? "translate-y-24" : ""}`}
      data-assistant-launcher
    >
      {open && (
        <section
          role="dialog"
          aria-label="Asistente del despacho"
          className="flex h-[min(38rem,calc(100dvh-7rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-2xl shadow-brand-900/20"
        >
          <header className="flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
            <div>
              <p className="font-serif text-base font-semibold">Asistente</p>
              <p className="text-xs text-white/80">{context.matterNumber ? `Hablando de ${context.matterNumber}` : "Consultas, cálculos y acciones"}</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Cerrar el asistente">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-ink-50 px-3 py-4" aria-live="polite">
            {messages.map((m, i) =>
              m.from === "yo" ? (
                <p key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3.5 py-2 text-sm text-white">
                  {m.text}
                </p>
              ) : (
                <div key={i} className="max-w-[92%] space-y-2">
                  <div className="rounded-2xl rounded-bl-sm border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-800">
                    <p className="whitespace-pre-line">{m.text}</p>
                    {m.proposal && !m.done && <ProposalCard proposal={m.proposal} disabled={pending} onConfirm={(cmd) => confirm(i, cmd)} onCancel={() => cancel(i)} />}
                    {m.proposal && m.done && <p className="mt-1 text-xs text-ink-500">({m.proposal.summary})</p>}
                    {m.items && m.items.length > 0 && (
                      <ul className="mt-2 divide-y divide-ink-100">
                        {m.items.map((it, j) => (
                          <li key={j} className="py-1.5">
                            {it.href ? (
                              <Link href={it.href} className="link" onClick={() => setOpen(false)}>
                                {it.label}
                              </Link>
                            ) : (
                              <span className="font-medium text-ink-700">{it.label}</span>
                            )}
                            {it.detail && <span className="block text-xs text-ink-500">{it.detail}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {m.suggestions && i === messages.length - 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.suggestions.map((s) => (
                        <button key={s} onClick={() => ask(s)} className="rounded-full border border-brand-200 bg-surface px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {pending && <p className="text-xs text-ink-500">Buscando…</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 border-t border-ink-200 bg-surface p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              className="input"
              placeholder="Escribe tu pregunta…"
              aria-label="Pregunta para el asistente"
            />
            <button className="btn-primary shrink-0" disabled={pending || !input.trim()}>
              Enviar
            </button>
          </form>
        </section>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Cerrar el asistente" : "Abrir el asistente"}
        data-tour="asistente"
        className="flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-brand-600 text-sm font-semibold sm:h-14 sm:w-auto sm:px-5 text-white shadow-lg shadow-brand-900/30 transition-[background-color,transform] duration-150 hover:bg-brand-700 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.5A8 8 0 1 1 21 12Z" />
          <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
        </svg>
        <span className="max-sm:sr-only">Asistente</span>
      </button>
    </div>
  );
}
