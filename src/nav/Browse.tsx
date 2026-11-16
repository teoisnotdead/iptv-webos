/**
 * Página de filas estilo Netflix para el control remoto: una cabecera opcional (portada destacada) y
 * filas horizontales de tarjetas.
 *
 * - Virtualizada en los dos ejes: solo existen las filas a la vista y, en cada una, las tarjetas
 *   cercanas a su posición. Miles de películas no pesan en el TV.
 * - Las flechas se manejan aquí por índice (no por geometría): cada fila recuerda su columna, así
 *   que subir y bajar vuelve a la tarjeta donde estabas. En el borde izquierdo la tecla sigue a la
 *   navegación global (barra lateral).
 * - El desplazamiento es con transform: la página solo sube si la fila con foco no cabe, y en cada
 *   fila la tarjeta con foco queda en el segundo lugar.
 *
 * Las filas no pueden venir vacías.
 */
import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Card, CARD_HEIGHT, CARD_WIDTH, type CardModel, type CardShape } from "../ui/Card";
import { isTextInput, navKey } from "./keys";
import { activeLayer, enterZone } from "./spatial";
import { useRem } from "./useRem";
import styles from "./Browse.module.css";

export type BrowseRow = { key: string; title?: string; count?: string; shape: CardShape; cards: CardModel[] };

/** Medidas en rem (deben coincidir con Browse.module.css). */
const GAP = 1.5;
const TITLE_H = 3.4;
const NO_TITLE_H = 0.5;
/** Aire alrededor de las tarjetas dentro de su franja, para que el foco (escala y anillo) no se corte. */
const STRIP_PAD = 1.2;
const ROW_GAP = 1.2;
/** Margen izquierdo de la primera tarjeta. */
const LEFT = 4;
/** Aire arriba de la fila con foco cuando la página sube. */
const TOP_PAD = 2;
/** Tarjetas de más a cada lado de lo visible. Cada una es un póster más que decodificar al aparecer la fila. */
const OVERSCAN = 1;

const stripHeight = (r: BrowseRow) => CARD_HEIGHT[r.shape] + 2 * STRIP_PAD;
export const rowHeight = (r: BrowseRow) => (r.title ? TITLE_H : NO_TITLE_H) + stripHeight(r) + ROW_GAP;

type Props = {
  rows: BrowseRow[];
  /** Cabecera arriba de las filas (p. ej. la portada destacada), con su alto en rem. */
  header?: ComponentChildren;
  headerRem?: number;
  /** Prefijo de las zonas de navegación. */
  zone: string;
  onFocusCard?: (row: number, col: number) => void;
  class?: string;
};

/** ¿Hay algo enfocable dentro de `root` hacia ese lado de `from`? */
function hasFocusableToward(root: HTMLElement, from: HTMLElement, dir: "right" | "up"): boolean {
  const a = from.getBoundingClientRect();
  const all = root.querySelectorAll<HTMLElement>("[data-nav]");
  for (let i = 0; i < all.length; i++) {
    if (all[i] === from) continue;
    const b = all[i].getBoundingClientRect();
    if (!b.width || !b.height) continue;
    if (dir === "right" ? b.left >= a.right - 2 : b.bottom <= a.top + 2) return true;
  }
  return false;
}

export function Browse(p: Props) {
  const view = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const rem = useRem();
  const [size, setSize] = useState({ w: 1800, h: 1080 });
  const [focusRow, setFocusRow] = useState(-1);
  const [, setTick] = useState(0);
  const cols = useRef(new Map<string, number>());
  const pending = useRef<{ r: number; c: number } | null>(null);

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

  // `focus()` desplaza los contenedores con overflow para mostrar el elemento. Aquí todo se mueve con
  // transform, así que ese desplazamiento se anula (Chromium 53 no tiene `focus({ preventScroll })`).
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

  const rows = p.rows;
  const headerH = p.header ? p.headerRem || 0 : 0;
  const tops: number[] = [];
  let acc = headerH;
  for (const r of rows) {
    tops.push(acc);
    acc += rowHeight(r);
  }

  const viewW = size.w / rem;
  const viewH = size.h / rem;
  const fr = Math.min(focusRow, rows.length - 1);

  const colOf = (i: number) => {
    const r = rows[i];
    return Math.max(0, Math.min(cols.current.get(r.key) || 0, r.cards.length - 1));
  };

  // La página sube solo si la fila con foco no cabe entera.
  let y = 0;
  if (fr >= 0 && tops[fr] + rowHeight(rows[fr]) > viewH) y = Math.max(0, tops[fr] - TOP_PAD);

  function findCard(r: number, c: number): HTMLElement | null {
    return view.current ? view.current.querySelector<HTMLElement>(`[data-row="${r}"][data-col="${c}"]`) : null;
  }

  function go(r: number, c: number) {
    const row = rows[r];
    if (!row) return;
    cols.current.set(row.key, c);
    setFocusRow(r);
    setTick((n) => n + 1);
    const el = findCard(r, c);
    if (el) el.focus();
    else pending.current = { r, c };
  }

  // Foco pendiente de una tarjeta que no existía en el DOM antes de este render.
  useLayoutEffect(() => {
    if (!pending.current) return;
    const el = findCard(pending.current.r, pending.current.c);
    if (el) {
      pending.current = null;
      el.focus();
    }
  });

  function onKeyDown(e: KeyboardEvent) {
    const v = view.current;
    if (!v || !activeLayer().contains(v)) return;
    const k = navKey(e);
    if (k !== "left" && k !== "right" && k !== "up" && k !== "down") return;
    const t = e.target as HTMLElement;
    const card = t.closest ? (t.closest("[data-row]") as HTMLElement | null) : null;

    if (!card || !v.contains(card)) {
      const h = head.current;
      if (!h || !h.contains(t)) return;
      // En un campo de texto, izquierda y derecha mueven el cursor (lo resuelve la navegación global).
      if (isTextInput(t) && (k === "left" || k === "right")) return;
      // En la cabecera: abajo entra a la primera fila. Derecha y arriba se mueven solo entre sus
      // botones (si no, el foco saltaría en diagonal a una tarjeta o a la barra lateral); izquierda
      // sigue a la navegación normal para llegar a la barra.
      if (k === "down") {
        if (rows.length) {
          e.preventDefault();
          go(0, colOf(0));
        }
      } else if (k !== "left" && !hasFocusableToward(h, t, k)) e.preventDefault();
      return;
    }

    const r = Number(card.getAttribute("data-row"));
    const c = Number(card.getAttribute("data-col"));
    const len = rows[r] ? rows[r].cards.length : 0;
    if (k === "left") {
      if (c > 0) {
        e.preventDefault();
        go(r, c - 1);
      }
    } else if (k === "right") {
      e.preventDefault();
      if (c < len - 1) go(r, c + 1);
    } else if (k === "up") {
      if (r > 0) {
        e.preventDefault();
        go(r - 1, colOf(r - 1));
      } else if (head.current) {
        e.preventDefault();
        setFocusRow(-1);
        enterZone(head.current);
      }
    } else {
      e.preventDefault();
      if (r < rows.length - 1) go(r + 1, colOf(r + 1));
    }
  }

  function onCardFocus(r: number, c: number) {
    const key = rows[r].key;
    if (cols.current.get(key) !== c || focusRow !== r) {
      cols.current.set(key, c);
      setFocusRow(r);
      setTick((n) => n + 1);
    }
    if (p.onFocusCard) p.onFocusCard(r, c);
  }

  // Filas que se ven (más la de foco, que siempre existe).
  const visible: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const top = tops[i] - y;
    if ((top + rowHeight(rows[i]) > -4 && top < viewH + 4) || i === fr) visible.push(i);
  }

  return (
    <div class={`${styles.view} ${p.class || ""}`} ref={view} onKeyDown={onKeyDown}>
      <div class={styles.track} style={{ transform: `translate3d(0, ${-y}rem, 0)` }}>
        {p.header && (
          <div class={styles.header} ref={head} style={{ height: `${headerH}rem` }} data-nav-zone={`${p.zone}-header`} onFocusIn={() => setFocusRow(-1)}>
            {p.header}
          </div>
        )}
        {visible.map((i) => {
          const row = rows[i];
          const step = CARD_WIDTH[row.shape] + GAP;
          const fit = Math.max(1, Math.floor((viewW - LEFT + GAP) / step));
          const c = colOf(i);
          const first = Math.max(0, Math.min(c - 1, row.cards.length - fit));
          const from = Math.max(0, first - OVERSCAN);
          const to = Math.min(row.cards.length - 1, first + fit + OVERSCAN);
          const cards = [];
          for (let j = from; j <= to; j++) {
            const card = row.cards[j];
            cards.push(
              <Card
                key={card.key}
                card={card}
                shape={row.shape}
                row={i}
                col={j}
                isDefault={j === c}
                style={{ left: `${STRIP_PAD + j * step}rem`, top: `${STRIP_PAD}rem` }}
                onFocus={() => onCardFocus(i, j)}
              />,
            );
          }
          return (
            <section key={row.key} class={styles.row} style={{ top: `${tops[i]}rem` }} data-nav-zone={`${p.zone}-${row.key}`}>
              {row.title ? (
                <h2 class={styles.title}>
                  {row.title}
                  {row.count && <span class={styles.count}>{row.count}</span>}
                </h2>
              ) : (
                <div class={styles.noTitle} />
              )}
              <div class={styles.strip} style={{ height: `${stripHeight(row)}rem`, marginLeft: `${LEFT - STRIP_PAD}rem` }}>
                <div class={styles.cards} style={{ transform: `translate3d(${-first * step}rem, 0, 0)` }}>
                  {cards}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
