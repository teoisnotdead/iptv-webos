import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { sized } from "../lib/images";
import { Icon } from "./Icon";
import styles from "./Hero.module.css";

type Props = {
  /** Texto chico sobre el título ("DESTACADO · PELÍCULA"). */
  eyebrow: string;
  title: string;
  meta?: Array<string | undefined>;
  rating?: string | null;
  plot?: string;
  backdrop?: string;
  poster?: string;
  /** Botones (el que lleve `autofocus` recibe el foco al entrar a la pantalla). */
  children?: ComponentChildren;
};

/**
 * Destacado de portada, como en la web: fondo a la derecha que se funde con el negro, o el póster
 * si no hay fondo. Sin desenfoques (en el TV cuestan caro).
 */
export function Hero(p: Props) {
  const [bdFailed, setBdFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  useEffect(() => {
    setBdFailed(false);
    setPosterFailed(false);
  }, [p.backdrop, p.poster]);

  const bd = p.backdrop && !bdFailed ? sized(p.backdrop, "w1280") : "";
  const poster = !bd && p.poster && !posterFailed ? sized(p.poster, "w342") : "";
  const meta = (p.meta || []).filter(Boolean) as string[];

  return (
    <section class={styles.hero}>
      <div key="glow" class={styles.glow} />
      {bd && <img key="bd" class={styles.backdrop} src={bd} alt="" onError={() => setBdFailed(true)} />}
      {bd && <div key="side" class={styles.shadeSide} />}
      {bd && <div key="bottom" class={styles.shadeBottom} />}
      {poster && (
        <div key="poster" class={styles.poster}>
          <img src={poster} alt="" onError={() => setPosterFailed(true)} />
        </div>
      )}

      <div key="content" class={styles.content}>
        <span class={styles.eyebrow}>{p.eyebrow}</span>
        <h1 class={styles.title}>{p.title}</h1>
        {(p.rating || meta.length > 0) && (
          <div class={styles.meta}>
            {p.rating && (
              <span class={styles.rating}>
                <Icon name="star" class={styles.star} />
                {p.rating}
              </span>
            )}
            {meta.map((m, i) => (
              <span key={i} class={styles.metaItem}>
                {m}
              </span>
            ))}
          </div>
        )}
        {p.plot && <p class={styles.plot}>{p.plot}</p>}
        {p.children && <div class={styles.actions}>{p.children}</div>}
      </div>
    </section>
  );
}
