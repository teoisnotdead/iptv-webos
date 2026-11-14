/**
 * Tecla Atrás. Cada pantalla o diálogo registra un manejador ligado a un elemento suyo; gana el
 * elemento más adentro / más abajo en el documento (un diálogo abierto antes que su pantalla, la
 * pantalla completa antes que la lista). Un manejador que devuelve `false` deja pasar la tecla al
 * siguiente. Si nadie la toma, corre el respaldo (en la raíz: preguntar si salir).
 */
import { useEffect, useRef } from "preact/hooks";

type Entry = { el: () => Element | null; run: () => boolean | void };

const entries: Entry[] = [];
let fallback: () => void = () => undefined;

export function setBackFallback(fn: () => void): void {
  fallback = fn;
}

export function handleBack(): void {
  const live = entries.filter((e) => {
    const el = e.el();
    return el && document.body.contains(el);
  });
  // Primero el que está después en el documento (los hijos quedan después que sus padres).
  live.sort((a, b) => (a.el()!.compareDocumentPosition(b.el()!) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1));
  for (const e of live) if (e.run() !== false) return;
  fallback();
}

/** Registra un manejador de Atrás mientras `active` sea verdadero. */
export function useBack(ref: { readonly current: Element | null }, handler: () => boolean | void, active = true): void {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    if (!active) return;
    const entry: Entry = { el: () => ref.current, run: () => h.current() };
    entries.push(entry);
    return () => {
      const i = entries.indexOf(entry);
      if (i >= 0) entries.splice(i, 1);
    };
  }, [active]);
}

/** Escucha teclas a nivel de documento (corre antes que la navegación global de `window`). */
export function useKeys(handler: (e: KeyboardEvent) => void, active = true): void {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    if (!active) return;
    const fn = (e: KeyboardEvent) => h.current(e);
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
    };
  }, [active]);
}
