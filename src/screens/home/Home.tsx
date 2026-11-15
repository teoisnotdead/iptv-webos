import { useEffect, useMemo, useState } from "preact/hooks";
import { loadChannels, loadMovies, loadShows, loadSeriesInfo, loadVodInfo } from "../../data/catalog";
import { useFavorites, useRecentChannels } from "../../data/library";
import type { Channel, Movie, Show } from "../../data/models";
import { continueWatching, getProgress, progressMap, useProgress } from "../../data/progress";
import { byId, newest, topRated } from "../../lib/collections";
import { movieDetails, seriesDetails } from "../../lib/mappers";
import { useAsync } from "../../lib/useAsync";
import { Browse, type BrowseRow } from "../../nav/Browse";
import { useFocusWhenReady } from "../../nav/layer";
import { Wordmark } from "../../ui/Brand";
import { Button } from "../../ui/Button";
import { Hero } from "../../ui/Hero";
import { Message } from "../../ui/Status";
import { channelCard, continueCard, movieCard, pickFeatured, showCard } from "../cards";
import { openMovie, openShow, playVod, section } from "../router";

const ROW_MAX = 30;
/** Alto de la portada: deja ver entera la primera fila debajo (1080 px = 67,5 rem). */
const HERO_REM = 35;

type Data = { movies: Movie[]; shows: Show[]; channels: Channel[] };

/** Lo que la lista no pudo cargar queda vacío: Inicio muestra lo que haya. */
const orEmpty = <T,>(p: Promise<T[]>) => p.then((x) => ({ ok: true, x }), () => ({ ok: false, x: [] as T[] }));

/**
 * Inicio, estilo Netflix: portada con una película destacada y filas de lo personal (seguir viendo,
 * canales favoritos y recientes, mi lista) y de lo nuevo del catálogo.
 */
export function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    Promise.all([orEmpty(loadMovies()), orEmpty(loadShows()), orEmpty(loadChannels())]).then(([m, s, c]) => {
      if (!alive) return;
      if (!m.ok && !s.ok && !c.ok) setFailed(true);
      else setData({ movies: m.x, shows: s.x, channels: c.x });
    });
    return () => {
      alive = false;
    };
  }, [reload]);

  const favLive = useFavorites("live");
  const favMovies = useFavorites("movie");
  const favSeries = useFavorites("series");
  const recentLive = useRecentChannels();
  const cont = useProgress(() => continueWatching());
  const progress = useProgress(progressMap);

  const maps = useMemo(() => (data ? { movies: byId(data.movies), shows: byId(data.shows), channels: byId(data.channels) } : null), [data]);

  // Destacado: una película (o una serie si no hay películas), elegida una vez por carga.
  const featured = useMemo(() => {
    if (!data) return null;
    const m = pickFeatured(data.movies);
    if (m) return { movie: m, show: null };
    const s = pickFeatured(data.shows);
    return s ? { movie: null, show: s } : null;
  }, [data]);

  const info = useAsync<unknown>(
    () => (featured ? (featured.movie ? loadVodInfo(featured.movie.id) : loadSeriesInfo(featured.show!.id)) : Promise.resolve(null)),
    [featured],
  );

  // Las listas fijas se calculan una vez por catálogo: las filas se rearman cada vez que se guarda el
  // avance de un video (cada 10 s mientras se ve algo), y recorrer miles de títulos ahí se nota.
  const lists = useMemo(
    () =>
      data
        ? {
            newMovies: newest(data.movies, ROW_MAX),
            newShows: newest(data.shows, ROW_MAX),
            topMovies: topRated(data.movies, ROW_MAX),
            topShows: topRated(data.shows, ROW_MAX),
          }
        : null,
    [data],
  );

  const rows = useMemo(() => {
    if (!data || !maps || !lists) return [];
    const out: BrowseRow[] = [];
    const pick = <T,>(ids: number[], m: Map<number, T>) => ids.map((id) => m.get(id)).filter((x): x is T => !!x);

    if (cont.length) out.push({ key: "continue", title: "Seguir viendo", shape: "poster", cards: cont.map(continueCard) });
    const fav = pick(favLive, maps.channels);
    if (fav.length) out.push({ key: "fav-live", title: "Canales favoritos", shape: "logo", cards: fav.map(channelCard) });
    const recent = pick(recentLive, maps.channels);
    if (recent.length) out.push({ key: "recent-live", title: "Vistos recientemente", shape: "logo", cards: recent.map(channelCard) });
    if (lists.newMovies.length)
      out.push({ key: "new-movies", title: "Películas recientes", shape: "poster", cards: lists.newMovies.map((m) => movieCard(m, progress)) });
    if (lists.newShows.length) out.push({ key: "new-series", title: "Series recientes", shape: "poster", cards: lists.newShows.map(showCard) });
    const mine = pick(favMovies, maps.movies)
      .map((m) => movieCard(m, progress))
      .concat(pick(favSeries, maps.shows).map(showCard));
    if (mine.length) out.push({ key: "my-list", title: "Mi lista", shape: "poster", cards: mine });
    if (lists.topMovies.length)
      out.push({ key: "top-movies", title: "Películas mejor valoradas", shape: "poster", cards: lists.topMovies.map((m) => movieCard(m, progress)) });
    if (lists.topShows.length) out.push({ key: "top-series", title: "Series mejor valoradas", shape: "poster", cards: lists.topShows.map(showCard) });
    return out;
  }, [data, maps, lists, cont, favLive, favMovies, favSeries, recentLive, progress]);

  useFocusWhenReady(!!data || failed);

  if (failed) {
    return (
      <Message icon="alert" title="No se pudo cargar el catálogo" text="Revisa tu conexión e inténtalo de nuevo.">
        <Button variant="primary" icon="refresh" autofocus onClick={() => setReload((n) => n + 1)}>
          Reintentar
        </Button>
      </Message>
    );
  }
  if (!data) return <Message loading title="Preparando tu inicio…" text="La primera vez puede tardar un poco." />;

  return <Browse zone="home" header={<HomeHero featured={featured} info={info.value} />} headerRem={HERO_REM} rows={rows} />;
}

function HomeHero({ featured, info }: { featured: { movie: Movie | null; show: Show | null } | null; info: unknown }) {
  if (featured && featured.movie) {
    const m = featured.movie;
    const d = movieDetails(info, m);
    const prog = getProgress("movie", String(m.id));
    const resumable = !!prog && !prog.done;
    return (
      <Hero eyebrow="Destacado · Película" title={d.title} rating={d.rating} meta={[d.year, d.duration].concat(d.genres.slice(0, 2))} plot={d.plot} backdrop={d.backdrop} poster={d.poster}>
        <Button variant="primary" icon="play" autofocus onClick={() => playVod({ kind: "movie", id: String(m.id), ext: d.ext, title: d.title, img: m.img, resume: true })}>
          {resumable ? "Continuar" : "Reproducir"}
        </Button>
        <Button icon="info" onClick={() => openMovie(m)}>
          Más información
        </Button>
      </Hero>
    );
  }
  if (featured && featured.show) {
    const s = featured.show;
    const d = seriesDetails(info, s);
    return (
      <Hero eyebrow="Destacado · Serie" title={d.title} rating={d.rating} meta={[d.year].concat(d.genres.slice(0, 2))} plot={d.plot} backdrop={d.backdrop} poster={d.cover}>
        <Button variant="primary" icon="play" autofocus onClick={() => openShow(s)}>
          Ver serie
        </Button>
      </Hero>
    );
  }
  return (
    <Hero eyebrow="Bienvenido" title={<Wordmark big />} plot="Tus canales en vivo, películas y series, en la pantalla grande.">
      <Button variant="primary" icon="live" autofocus onClick={() => section.set("live")}>
        Ver TV en vivo
      </Button>
    </Hero>
  );
}
