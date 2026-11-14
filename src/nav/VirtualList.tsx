/**
 * Lista vertical virtualizada (filas de alto fijo) para el control remoto: solo existen en el DOM las
 * filas visibles, así miles de canales no pesan en el TV.
 *
 * Arriba/abajo (y CH±, de a una página) se manejan aquí por índice; en el borde la tecla sigue a la
 * navegación global para salir de la lista. La fila con foco queda marcada `data-nav-default`, así
 * que volver a la lista cae donde estabas.
 */
import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { navKey } from "./keys";
import { activeLayer } from "./spatial";
import { useRem } from "./useRem";
import { cx } from "../lib/cx";
import styles from "./VirtualList.module.css";

export type Jump = { index: number; focus: boolean; seq: number };

type Props<T> = {
  items: T[];
  /** Alto de cada fila, en rem. */
  rowRem: number;
  keyOf: (item: T) => string | number;
  render: (item: T, index: number) => ComponentChildren;
  /** Nombre de la zona de navegación. */
  zone: string;
  /** Fila donde parte el foco cada vez que cambia `items`. */
  initial?: number;
  /** Lleva el foco (o solo la posición) a una fila desde afuera; cambia `seq` para repetir. */
  jump?: Jump | null;
  rowClass?: string;
  class?: string;
  onPick?: (item: T, index: number) => void;
  onFocusItem?: (item: T, index: number) => void;
  empty?: ComponentChildren;
  overscan?: number;
};

export function VirtualList<T>(p: Props<T>) {
  const box = useRef<HTMLDivElement>(null);
  const rem = useRem();
  const rowPx = Math.round(p.rowRem * rem);
  const total = p.items.length;
  const overscan = p.overscan ?? 4;

  const [height, setHeight] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [focusIdx, setFocusIdx] = useState(0);
  const pending = useRef<number | null>(null);
  const raf = useRef(0);

  const clamp = (i: number) => Math.max(0, Math.min(total - 1, i));

  function scrollTo(top: number) {
    const el = box.current;
    if (!el) return;
    el.scrollTop = Math.max(0, top);
    setScroll(el.scrollTop);
  }

  /** Deja la fila `i` visible con una fila de aire arriba y abajo. */
  function ensureVisible(i: number) {
    const el = box.current;
    if (!el) return;
    const top = i * rowPx;
    const view = el.clientHeight;
    if (top - rowPx < el.scrollTop) scrollTo(top - rowPx);
    else if (top + 2 * rowPx > el.scrollTop + view) scrollTo(top + 2 * rowPx - view);
  }

  function centerOn(i: number) {
    const el = box.current;
    if (el) scrollTo(i * rowPx - (el.clientHeight - rowPx) / 2);
  }

  function focusRow(i: number) {
    const row = box.current?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    if (row) row.focus();
    else pending.current = i;
  }

  function go(i: number) {
    setFocusIdx(i);
    ensureVisible(i);
    focusRow(i);
  }

  // Medir el alto (sin ResizeObserver en Chromium 53).
  useLayoutEffect(() => {
    const measure = () => {
      if (box.current) setHeight(box.current.clientHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Lista nueva (otra carpeta): el foco parte en `initial`.
  useLayoutEffect(() => {
    const i = total ? clamp(p.initial ?? 0) : 0;
    setFocusIdx(i);
    centerOn(i);
  }, [p.items, rowPx]);

  useLayoutEffect(() => {
    if (!p.jump || !total) return;
    const i = clamp(p.jump.index);
    setFocusIdx(i);
    centerOn(i);
    if (p.jump.focus) focusRow(i);
  }, [p.jump && p.jump.seq]);

  // Foco pendiente de una fila que todavía no estaba en el DOM.
  useLayoutEffect(() => {
    if (pending.current == null) return;
    const row = box.current?.querySelector<HTMLElement>(`[data-index="${pending.current}"]`);
    if (row) {
      pending.current = null;
      row.focus();
    }
  });

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
    },
    [],
  );

  function onScroll() {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      if (box.current) setScroll(box.current.scrollTop);
    });
  }

  function onKeyDown(e: KeyboardEvent) {
    // Tapada por otra capa (pantalla completa, diálogo): las teclas no son para esta lista.
    if (!box.current || !activeLayer().contains(box.current)) return;
    const k = navKey(e);
    const page = Math.max(1, Math.floor(height / rowPx) - 1);
    let next: number;
    if (k === "down") next = focusIdx + 1;
    else if (k === "up") next = focusIdx - 1;
    else if (k === "chdown") next = Math.min(total - 1, focusIdx + page);
    else if (k === "chup") next = Math.max(0, focusIdx - page);
    else return;
    if (next < 0 || next >= total || next === focusIdx) return; // borde: que siga la navegación global
    e.preventDefault();
    go(next);
  }

  const first = Math.max(0, Math.floor(scroll / rowPx) - overscan);
  const last = Math.min(total - 1, Math.ceil((scroll + (height || 1080)) / rowPx) + overscan);
  const indices: number[] = [];
  for (let i = first; i <= last; i++) indices.push(i);
  // La fila con foco siempre existe, aunque el puntero haya desplazado la lista.
  if (total && (focusIdx < first || focusIdx > last)) indices.push(clamp(focusIdx));

  return (
    <div ref={box} class={cx(styles.box, p.class)} data-nav-zone={p.zone} onScroll={onScroll} onKeyDown={onKeyDown}>
      {total === 0 ? (
        p.empty
      ) : (
        <div class={styles.inner} style={{ height: `${total * rowPx}px` }}>
          {indices.map((i) => {
            const item = p.items[i];
            return (
              <button
                key={p.keyOf(item)}
                type="button"
                data-nav
                data-index={i}
                data-nav-default={i === focusIdx ? "" : undefined}
                class={cx(styles.row, p.rowClass)}
                style={{ top: `${i * rowPx}px`, height: `${rowPx}px` }}
                onFocus={() => {
                  setFocusIdx(i);
                  p.onFocusItem?.(item, i);
                }}
                onClick={() => p.onPick?.(item, i)}
              >
                {p.render(item, i)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
