import { useEffect, useState } from "preact/hooks";
import { cx } from "../lib/cx";
import { formatCount, hueOf, initials, placeholderBackground } from "../lib/format";
import { sized, type ImageSize } from "../lib/images";
import { Icon } from "./Icon";
import styles from "./Card.module.css";

/**
 * Formas de tarjeta. Sus medidas (en rem) las usan las filas y grillas para ubicar y desplazar sin
 * medir el DOM: si cambias el CSS, cambia también esto.
 */
export type CardShape = "poster" | "logo" | "wide" | "chip";

export const CARD_WIDTH: Record<CardShape, number> = { poster: 14, logo: 16, wide: 24, chip: 14 };
/** Alto total de la tarjeta (marco + textos). */
export const CARD_HEIGHT: Record<CardShape, number> = { poster: 25.4, logo: 12, wide: 18.2, chip: 4.5 };

/**
 * Los pósters se dibujan a 14 rem (224 px): w185 casi no se nota y se decodifica unas 3 veces más
 * rápido que w342. Decodificar pósters era lo que más frenaba las filas en el TV.
 */
const IMAGE_SIZE: Record<CardShape, ImageSize> = { poster: "w185", logo: "w185", wide: "w342", chip: "w185" };

export type CardModel = {
  key: string;
  title: string;
  /** Segunda línea, más tenue (año, "T1 · E3", "Quedan 20 min"…). */
  sub?: string;
  img?: string;
  rating?: string | null;
  /** 0 a 1: barrita de lo visto. */
  progress?: number;
  watched?: boolean;
  /** Tarjeta "Ver todas (N)" al final de una fila. */
  more?: number;
  /** Elegido (temporada actual, canal favorito…). */
  active?: boolean;
  open: () => void;
};

type Props = {
  card: CardModel;
  shape: CardShape;
  /** Posición en una fila o grilla (para la navegación por índice). */
  row?: number;
  col?: number;
  isDefault?: boolean;
  style?: Record<string, string>;
  onFocus?: () => void;
};

export function Card({ card, shape, row, col, isDefault, style, onFocus }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [card.img]);

  const src = card.img && !failed ? sized(card.img, IMAGE_SIZE[shape]) : "";
  const more = card.more != null;

  let art;
  if (shape === "chip") art = card.title;
  else if (more)
    art = (
      <span class={styles.more}>
        <Icon name="chevron" class={styles.moreIcon} />
        <span class={styles.moreText}>Ver todas</span>
        <span class={styles.moreCount}>{formatCount(card.more!)}</span>
      </span>
    );
  else if (src) art = <img class={shape === "logo" ? styles.logoImg : styles.img} src={src} alt="" onError={() => setFailed(true)} />;
  else if (shape === "logo") art = <span class={styles.initials}>{initials(card.title)}</span>;
  else art = <span class={styles.placeholder}>{card.title}</span>;

  const frameStyle =
    shape === "chip" || more || src
      ? undefined
      : { background: shape === "logo" ? `hsl(${hueOf(card.title)}, 30%, 24%)` : placeholderBackground(card.title) };

  return (
    <button
      type="button"
      data-nav
      data-row={row}
      data-col={col}
      data-nav-default={isDefault ? "" : undefined}
      class={cx(styles.card, styles[shape], card.active && styles.active)}
      style={style}
      onFocus={onFocus}
      onClick={card.open}
    >
      <span class={styles.frame} style={frameStyle}>
        {art}
        {card.rating && !more && (
          <span class={styles.rating}>
            <Icon name="star" class={styles.ratingIcon} />
            {card.rating}
          </span>
        )}
        {card.watched && (
          <span class={styles.watched}>
            <Icon name="check" />
          </span>
        )}
        {card.progress ? (
          <span class={styles.bar}>
            <span class={styles.barFill} style={{ width: `${Math.round(card.progress * 100)}%` }} />
          </span>
        ) : null}
      </span>
      {shape !== "chip" && !more && <span class={styles.name}>{card.title}</span>}
      {shape !== "chip" && !more && card.sub && <span class={styles.sub}>{card.sub}</span>}
    </button>
  );
}
