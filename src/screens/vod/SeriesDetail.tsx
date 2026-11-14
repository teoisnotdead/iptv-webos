import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { loadSeriesInfo } from "../../data/catalog";
import { toggleFavorite, useFavorites } from "../../data/library";
import type { Show } from "../../data/models";
import { fractionOf, seriesProgress, useProgress, type ProgressEntry } from "../../data/progress";
import { allEpisodes, episodeCode, seriesDetails, type EpisodeDetails, type SeriesDetails } from "../../lib/mappers";
import { useAsync } from "../../lib/useAsync";
import { useBack } from "../../nav/back";
import { Browse, type BrowseRow } from "../../nav/Browse";
import { useLayerFocus } from "../../nav/layer";
import { focusInitial } from "../../nav/spatial";
import { Button } from "../../ui/Button";
import type { CardModel } from "../../ui/Card";
import { Spinner } from "../../ui/Status";
import { closeOverlay, playVod } from "../router";
import { Backdrop, Meta } from "./DetailParts";
import styles from "./Detail.module.css";

/** Cabecera de la ficha (rem): con temporadas + episodios debajo, todo cabe sin desplazar (1080 px = 67,5 rem). */
const HEADER_REM = 33;
/** Al pasar por las temporadas, los episodios cambian tras esta pausa. */
const SEASON_DELAY_MS = 300;

type Target = { ep: EpisodeDetails; resume: boolean; label: string };

/** Qué ofrecer en el botón principal: seguir el último episodio a medias, el siguiente al último visto o el primero. */
function nextTarget(s: SeriesDetails, prog: Map<string, ProgressEntry>): Target | null {
  const eps = allEpisodes(s);
  if (!eps.length) return null;
  let last: ProgressEntry | null = null;
  prog.forEach((e) => {
    if (!last || e.at > last.at) last = e;
  });
  const l = last as ProgressEntry | null;
  if (l) {
    const i = eps.findIndex((e) => e.id === l.id);
    if (i >= 0 && !l.done) return { ep: eps[i], resume: true, label: `Continuar ${episodeCode(eps[i])}` };
    if (i >= 0 && i + 1 < eps.length) return { ep: eps[i + 1], resume: true, label: `Ver ${episodeCode(eps[i + 1])}` };
  }
  return { ep: eps[0], resume: false, label: `Ver ${episodeCode(eps[0])}` };
}

/** Ficha de una serie: datos, Continuar/Ver, Mi lista, temporadas y episodios. */
export function SeriesDetail({ show, okey }: { show: Show; okey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayerFocus(ref);
  useBack(ref, () => closeOverlay(okey));

  const info = useAsync(() => loadSeriesInfo(show.id), [show.id]);
  const d = useMemo(() => seriesDetails(info.value, show), [info.value, show]);
  const prog = useProgress(() => seriesProgress(show.id), [show.id]);
  const fav = useFavorites("series").indexOf(show.id) >= 0;
  const target = info.value ? nextTarget(d, prog) : null;

  const [season, setSeason] = useState<number | null>(null);
  const seasonTimer = useRef(0);
  useEffect(
    () => () => {
      clearTimeout(seasonTimer.current);
    },
    [],
  );

  // Al llegar los episodios aparece "Continuar/Ver": si el usuario no se movió de la cabecera, el foco pasa ahí.
  const movedToPlay = useRef(false);
  useEffect(() => {
    if (!target || movedToPlay.current || !ref.current) return;
    movedToPlay.current = true;
    const a = document.activeElement;
    const inHeader = !!a && !!(a as HTMLElement).closest && !!(a as HTMLElement).closest(`.${styles.seriesHead}`);
    if (!a || a === document.body || inHeader) focusInitial(ref.current);
  }, [!!target]);

  // Por defecto, la temporada del episodio que toca ver.
  const sIdx = Math.max(0, season ?? (target ? d.seasons.findIndex((s) => s.num === target.ep.season) : 0));
  const current = d.seasons[sIdx];

  function play(ep: EpisodeDetails, resume: boolean) {
    playVod({ kind: "series", id: ep.id, ext: ep.ext, title: d.title, img: show.img, seriesId: show.id, season: ep.season, ep: ep.num, epTitle: ep.title, resume });
  }

  const rows: BrowseRow[] = [];
  if (d.seasons.length > 1) {
    rows.push({
      key: "seasons",
      shape: "chip",
      cards: d.seasons.map(
        (s, i): CardModel => ({
          key: `s${s.num}`,
          title: s.label,
          active: i === sIdx,
          open: () => setSeason(i),
        }),
      ),
    });
  }
  if (current && current.episodes.length) {
    rows.push({
      key: `eps-${current.num}`,
      title: current.label,
      count: `${current.episodes.length} ${current.episodes.length === 1 ? "episodio" : "episodios"}`,
      shape: "wide",
      cards: current.episodes.map((e): CardModel => {
        const p = prog.get(e.id);
        return {
          key: e.id,
          title: e.title ? `${e.num}. ${e.title}` : `Episodio ${e.num}`,
          sub: p && p.done ? "Visto" : e.duration,
          img: e.thumb || d.backdrop || d.cover,
          progress: fractionOf(p),
          watched: !!p && p.done,
          open: () => play(e, true),
        };
      }),
    });
  }

  function onFocusCard(row: number, col: number) {
    if (rows[row] && rows[row].key === "seasons" && col !== sIdx) {
      clearTimeout(seasonTimer.current);
      seasonTimer.current = window.setTimeout(() => setSeason(col), SEASON_DELAY_MS);
    }
  }

  const header = (
    <div class={styles.seriesHead}>
      <span class={styles.eyebrow}>Serie</span>
      <h1 class={styles.title}>{d.title}</h1>
      <Meta rating={d.rating} items={[d.year, d.seasons.length ? `${d.seasons.length} ${d.seasons.length === 1 ? "temporada" : "temporadas"}` : undefined].concat(d.genres.slice(0, 2))} />
      {d.plot && <p class={styles.plotShort}>{d.plot}</p>}
      <div key="actions" class={styles.actions}>
        {target ? (
          <Button key="play" variant="primary" icon="play" autofocus onClick={() => play(target.ep, target.resume)}>
            {target.label}
          </Button>
        ) : info.error ? (
          <Button key="retry" variant="primary" icon="refresh" autofocus onClick={info.reload}>
            Reintentar
          </Button>
        ) : null}
        <Button key="fav" icon={fav ? "check" : "starOutline"} selected={fav} autofocus={!target && !info.error} onClick={() => toggleFavorite("series", show.id)}>
          {fav ? "En mi lista" : "Mi lista"}
        </Button>
        {info.loading && <Spinner class={styles.inlineSpinner} />}
        {info.error && <span class={styles.note}>No se pudieron cargar los episodios.</span>}
        {info.value && !d.seasons.length && <span class={styles.note}>Esta serie todavía no tiene episodios.</span>}
      </div>
    </div>
  );

  return (
    <div class={styles.layer} ref={ref} data-nav-layer>
      <Backdrop key="bd" backdrop={d.backdrop} poster={d.cover} name={d.title} />
      <div key="body" class={styles.seriesBody}>
        <Browse zone={`series-${show.id}`} header={header} headerRem={HEADER_REM} rows={rows} onFocusCard={onFocusCard} />
      </div>
    </div>
  );
}
