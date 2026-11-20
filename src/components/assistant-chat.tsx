"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { askAssistantAction } from "@/app/(app)/asistente/actions";
import type { AssistantAnswer } from "@/lib/assistant";

type Message = { from: "yo" } & { text: string } | ({ from: "asistente" } & AssistantAnswer);

const START: Message = {
  from: "asistente",
  text: "Hola. Pregúntame por expedientes, clientes, cobros y plazos, o una duda jurídica: respondo con la base de conocimiento del despacho y las leyes cargadas, y hago cálculos de plazos y liquidaciones.",
  suggestions: ["Resumen", "Plazos de esta semana", "¿Cuánto tengo para apelar una sentencia?", "Liquidación de 3 años con salario de 600 000"],
};

/** Burbuja de chat del asistente: abajo a la derecha en todas las pantallas. */
export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([START]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const res = await askAssistantAction(q);
      setMessages((m) => [...m, { from: "asistente", ...res }]);
    });
  }

  return (
    <div className="no-print fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          role="dialog"
          aria-label="Asistente del despacho"
          className="flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl shadow-brand-900/20"
        >
          <header className="flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
            <div>
              <p className="font-serif text-base font-semibold">Asistente</p>
              <p className="text-xs text-brand-100">Despacho, conocimiento, leyes y cálculos</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-2 text-brand-100 hover:bg-white/10 hover:text-white" aria-label="Cerrar el asistente">
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
                  <div className="rounded-2xl rounded-bl-sm border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800">
                    <p className="whitespace-pre-line">{m.text}</p>
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
                        <button key={s} onClick={() => ask(s)} className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50">
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
            className="flex gap-2 border-t border-ink-200 bg-white p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={300}
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
        className="flex h-14 items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow-lg shadow-brand-900/30 transition-[background-color,transform] duration-150 hover:bg-brand-700 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
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
