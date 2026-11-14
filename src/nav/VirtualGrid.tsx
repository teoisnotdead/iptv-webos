/**
 * Grilla virtualizada de tarjetas (una categoría completa) para el control remoto. Mismo enfoque que
 * `Browse`: solo existen las filas a la vista, las flechas se manejan por índice y el desplazamiento
 * es con transform (la fila con foco queda en el segundo lugar).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Card, CARD_HEIGHT, CARD_WIDTH, type CardModel, type CardShape } from "../ui/Card";
import { navKey } from "./keys";
import { activeLayer } from "./spatial";
import { useRem } from "./useRem";
import styles from "./VirtualGrid.module.css";

const GAP_X = 1.5;
const GAP_Y = 1.4;
/** Aire para que el foco (escala y anillo) no se corte. */
const PAD = 1.2;
const LEFT = 4;
const OVERSCAN_ROWS = 1;

type Props = {
  items: CardModel[];
  shape: CardShape;
  zone: string;
  class?: string;
};

export function VirtualGrid(p: Props) {
  const view = useRef<HTMLDivElement>(null);
  const rem = useRem();
  const [size, setSize] = useState({ w: 1800, h: 900 });
  const [focusIdx, setFocusIdx] = useState(0);
  const pending = useRef<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = view.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Igual que en Browse: el desplazamiento es con transform y se anula el que provoca `focus()`.
  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const reset = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.scrollTop) t.scrollTop = 0;
      if (t.scrollLeft) t.scrollLeft = 0;
    };
    el.addEventListener("scroll", reset, true);
    return () => {
      el.removeEventListener("scroll", reset, true);
    };
  }, []);

  const n = p.items.length;
  const stepX = CARD_WIDTH[p.shape] + GAP_X;
  const stepY = CARD_HEIGHT[p.shape] + GAP_Y;
  const viewW = size.w / rem;
  const viewH = size.h / rem;
  const cols = Math.max(1, Math.floor((viewW - LEFT - PAD + GAP_X) / stepX));
  const rowsTotal = Math.ceil(n / cols);
  const fitRows = Math.max(1, Math.floor((viewH - PAD) / stepY));
  const idx = Math.min(focusIdx, Math.max(0, n - 1));
  const row = Math.floor(idx / cols);
  const topRow = Math.max(0, Math.min(row - 1, rowsTotal - fitRows));

  function findCard(i: number): HTMLElement | null {
    return view.current ? view.current.querySelector<HTMLElement>(`[data-col="${i}"]`) : null;
  }

  function go(i: number) {
    setFocusIdx(i);
    const el = findCard(i);
    if (el) el.focus();
    else pending.current = i;
  }

  useLayoutEffect(() => {
    if (pending.current == null) return;
    const el = findCard(pending.current);
    if (el) {
      pending.current = null;
      el.focus();
    }
  });

  function onKeyDown(e: KeyboardEvent) {
    const v = view.current;
    if (!v || !activeLayer().contains(v)) return;
    const k = navKey(e);
    const t = e.target as HTMLElement;
    if (!t.hasAttribute || !t.hasAttribute("data-col")) return;
    const i = Number(t.getAttribute("data-col"));
    const c = i % cols;
    if (k === "left") {
      if (c > 0) {
        e.preventDefault();
        go(i - 1);
      }
    } else if (k === "right") {
      e.preventDefault();
      if (c < cols - 1 && i + 1 < n) go(i + 1);
    } else if (k === "up") {
      if (i - cols >= 0) {
        e.preventDefault();
        go(i - cols);
      }
    } else if (k === "down") {
      e.preventDefault();
      if (i + cols < n) go(i + cols);
      else if (Math.floor(i / cols) < rowsTotal - 1) go(n - 1);
    }
  }

  const cards = [];
  const firstRow = Math.max(0, topRow - OVERSCAN_ROWS);
  const lastRow = Math.min(rowsTotal - 1, topRow + fitRows + OVERSCAN_ROWS);
  for (let r = firstRow; r <= lastRow; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (i >= n) break;
      const card = p.items[i];
      cards.push(
        <Card
          key={card.key}
          card={card}
          shape={p.shape}
          col={i}
          isDefault={i === idx}
          style={{ left: `${LEFT + c * stepX}rem`, top: `${PAD + r * stepY}rem` }}
          onFocus={() => setFocusIdx(i)}
        />,
      );
    }
  }

  return (
    <div class={`${styles.view} ${p.class || ""}`} ref={view} onKeyDown={onKeyDown} data-nav-zone={p.zone}>
      <div class={styles.track} style={{ transform: `translate3d(0, ${-topRow * stepY}rem, 0)` }}>
        {cards}
      </div>
    </div>
  );
}
