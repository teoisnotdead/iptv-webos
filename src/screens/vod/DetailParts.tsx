import { useEffect, useState } from "preact/hooks";
import { sized } from "../../lib/images";
import { Icon } from "../../ui/Icon";
import styles from "./Detail.module.css";

/** Fondo de la ficha: la imagen de fondo a la derecha, o el póster si no hay; sin nada, un brillo de marca. */
export function Backdrop({ backdrop, poster, name }: { backdrop: string; poster: string; name: string }) {
  const [bdFailed, setBdFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  useEffect(() => {
    setBdFailed(false);
    setPosterFailed(false);
  }, [backdrop, poster]);

  const bd = backdrop && !bdFailed ? sized(backdrop, "w1280") : "";
  const ps = !bd && poster && !posterFailed ? sized(poster, "w342") : "";
  return (
    <>
      <div key="glow" class={styles.glow} />
      {bd && <img key="bd" class={styles.backdrop} src={bd} alt={name} onError={() => setBdFailed(true)} />}
      {bd && <div key="side" class={styles.shadeSide} />}
      {bd && <div key="bottom" class={styles.shadeBottom} />}
      {ps && (
        <div key="poster" class={styles.poster}>
          <img src={ps} alt={name} onError={() => setPosterFailed(true)} />
        </div>
      )}
    </>
  );
}

export function Meta({ rating, items }: { rating: string | null; items: Array<string | undefined> }) {
  const list = items.filter(Boolean) as string[];
  if (!rating && !list.length) return null;
  return (
    <div class={styles.meta}>
      {rating && (
        <span class={styles.rating}>
          <Icon name="star" class={styles.star} />
          {rating}
        </span>
      )}
      {list.map((m, i) => (
        <span key={i}>{m}</span>
      ))}
    </div>
  );
}

export function Credits({ director, cast }: { director?: string; cast?: string }) {
  if (!director && !cast) return null;
  return (
    <dl class={styles.credits}>
      {director && (
        <div class={styles.credit}>
          <dt>Dirección</dt>
          <dd>{director}</dd>
        </div>
      )}
      {cast && (
        <div class={styles.credit}>
          <dt>Reparto</dt>
          <dd>{cast}</dd>
        </div>
      )}
    </dl>
  );
}
