import { useLayoutEffect } from "preact/hooks";
import { activeLayer, focusInitial } from "./spatial";

/**
 * Cuando una sección termina de cargar, el foco entra a su contenido si estaba suelto o en la barra
 * lateral (se acaba de elegir la sección). Si el usuario ya está en otra parte, no se lo quita.
 */
export function useFocusWhenReady(ready: boolean): void {
  useLayoutEffect(() => {
    if (!ready) return;
    const a = document.activeElement;
    if (a && a !== document.body && !a.closest('[data-nav-zone="sidebar"]')) return;
    const main = activeLayer().querySelector<HTMLElement>("main");
    if (main) focusInitial(main);
  }, [ready]);
}

/**
 * Una capa nueva (ficha, reproductor) toma el foco al montarse. Al cerrarse, el foco vuelve a donde
 * estaba. Se espera un instante porque la capa de abajo recién se vuelve visible en ese mismo render,
 * y un elemento oculto no puede recibir el foco.
 */
export function useLayerFocus(ref: { readonly current: HTMLElement | null }): void {
  useLayoutEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (ref.current) focusInitial(ref.current);
    return () => {
      setTimeout(() => {
        const a = document.activeElement;
        if (before && document.body.contains(before) && (!a || a === document.body)) before.focus();
      }, 0);
    };
  }, []);
}
