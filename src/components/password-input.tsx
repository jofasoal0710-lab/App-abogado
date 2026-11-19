"use client";

import { useEffect, useRef, useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

/**
 * Campo de contraseña con botón «Mostrar / Ocultar» para comprobar lo que se ha escrito.
 * Al enviar el formulario vuelve a ocultarse.
 */
export function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <span className="relative block">
      <input {...props} ref={ref} type={visible ? "text" : "password"} className="input pr-24" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
        className="absolute inset-y-1 right-1 rounded px-3 text-xs font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </span>
  );
}
