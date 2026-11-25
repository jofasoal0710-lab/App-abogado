"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_FIELD, TURNSTILE_SCRIPT, type TurnstileAction } from "@/lib/turnstile-core";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;
function loadTurnstile(nonce?: string): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TURNSTILE_SCRIPT;
    s.async = true;
    if (nonce) s.nonce = nonce;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile no disponible")));
    s.onerror = () => {
      loading = null;
      reject(new Error("No se pudo cargar Turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Verificación anti-robots de Cloudflare dentro de un formulario. Añade el campo oculto con el token; tras
 * cada envío pide uno nuevo (cada token sirve una sola vez), por si el servidor devuelve un error.
 */
export function Turnstile({ siteKey, action, nonce }: { siteKey: string; action: TurnstileAction; nonce?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | null = null;
    let cancelled = false;
    const form = box.current?.closest("form");
    const onSubmit = () => setTimeout(() => id && window.turnstile?.reset(id), 0);
    form?.addEventListener("submit", onSubmit);
    loadTurnstile(nonce)
      .then((t) => {
        if (cancelled || !box.current) return;
        id = t.render(box.current, { sitekey: siteKey, action, language: "es", theme: "auto", size: "flexible", "response-field-name": TURNSTILE_FIELD });
      })
      .catch(() => {
        if (box.current) box.current.textContent = "No se pudo cargar la verificación anti-robots. Revisa tu conexión y recarga la página.";
      });
    return () => {
      cancelled = true;
      form?.removeEventListener("submit", onSubmit);
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, action, nonce]);
  return <div ref={box} className="min-h-[65px] text-sm text-red-700" data-turnstile />;
}
