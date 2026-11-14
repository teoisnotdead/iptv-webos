import { useRef } from "preact/hooks";
import { loadVodInfo } from "../../data/catalog";
import { toggleFavorite, useFavorites } from "../../data/library";
import type { Movie } from "../../data/models";
import { fractionOf, getProgress, useProgress } from "../../data/progress";
import { timeLeft } from "../../lib/format";
import { movieDetails } from "../../lib/mappers";
import { useAsync } from "../../lib/useAsync";
import { useBack } from "../../nav/back";
import { useLayerFocus } from "../../nav/layer";
import { Button } from "../../ui/Button";
import { Spinner } from "../../ui/Status";
import { closeOverlay, playVod } from "../router";
import { Backdrop, Credits, Meta } from "./DetailParts";
import styles from "./Detail.module.css";

/** Ficha de una película: fondo, datos, Reproducir/Continuar, Desde el inicio y Mi lista. */
export function MovieDetail({ movie, okey }: { movie: Movie; okey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayerFocus(ref);
  useBack(ref, () => closeOverlay(okey));

  const info = useAsync(() => loadVodInfo(movie.id), [movie.id]);
  const d = movieDetails(info.value, movie);
  const prog = useProgress(() => getProgress("movie", String(movie.id)), [movie.id]);
  const fav = useFavorites("movie").indexOf(movie.id) >= 0;
  const resumable = !!prog && !prog.done;

  const play = (resume: boolean) => playVod({ kind: "movie", id: String(movie.id), ext: d.ext, title: d.title, img: movie.img, resume });

  return (
    <div class={styles.layer} ref={ref} data-nav-layer>
      <Backdrop key="bd" backdrop={d.backdrop} poster={d.poster} name={d.title} />
      <div key="content" class={styles.content}>
        <span class={styles.eyebrow}>Película</span>
        <h1 class={styles.title}>{d.title}</h1>
        <Meta rating={d.rating} items={[d.year, d.duration].concat(d.genres.slice(0, 3))} />

        {resumable && (
          <div key="progress" class={styles.progress}>
            <span class={styles.progressBar}>
              <span class={styles.progressFill} style={{ width: `${Math.round(fractionOf(prog) * 100)}%` }} />
            </span>
            <span>{timeLeft(prog!.pos, prog!.dur)}</span>
          </div>
        )}

        <div key="actions" class={styles.actions}>
          <Button key="play" variant="primary" icon="play" autofocus onClick={() => play(true)}>
            {resumable ? "Continuar" : "Reproducir"}
          </Button>
          {resumable && (
            <Button key="restart" icon="restart" onClick={() => play(false)}>
              Desde el inicio
            </Button>
          )}
          <Button key="fav" icon={fav ? "check" : "starOutline"} selected={fav} onClick={() => toggleFavorite("movie", movie.id)}>
            {fav ? "En mi lista" : "Mi lista"}
          </Button>
        </div>

        {d.plot ? <p class={styles.plot}>{d.plot}</p> : info.loading ? <Spinner class={styles.spinner} /> : null}
        <Credits director={d.director} cast={d.cast} />
      </div>
    </div>
  );
}
