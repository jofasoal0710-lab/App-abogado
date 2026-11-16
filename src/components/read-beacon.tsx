"use client";

import { startTransition, useEffect } from "react";
import { recordReadAction } from "@/app/(app)/read-actions";

/**
 * Registra que esta pantalla se ha mostrado. Vive en el cliente a propósito: Next precarga páginas
 * al pasar por los enlaces y eso ejecutaría el render del servidor sin que nadie la abriera; un
 * componente de cliente solo se monta cuando la pantalla se muestra de verdad.
 */
export function ReadBeacon(props: { matterId?: number; clientId?: number; kind: "ficha" | "factura" | "cliente"; detail: string }) {
  const { matterId, clientId, kind, detail } = props;
  useEffect(() => {
    startTransition(() => {
      void recordReadAction({ matterId, clientId, kind, detail });
    });
  }, [matterId, clientId, kind, detail]);
  return null;
}
