/**
 * Fichas de película y serie (`get_vod_info` / `get_series_info`) → modelos para la vista.
 * Los paneles son inconsistentes: cualquier campo puede faltar o venir con otro tipo, y los episodios
 * llegan como objeto por temporada o como arreglo de arreglos. Lo que falta se completa con la lista.
 */
import { int, obj, str } from "../data/xtream";
import { formatDuration, formatRating, splitList } from "./format";

/** Primer texto útil de un campo que puede venir como texto o arreglo de textos. */
function firstText(v: unknown): string {
  if (Array.isArray(v)) {
    for (const x of v) if (str(x)) return str(x);
    return "";
  }
  return str(v);
}

function yearOf(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    const m = /\d{4}/.exec(str(v));
    if (m) return m[0];
  }
  return undefined;
}

/** "01:52:00", "112" o segundos sueltos → "1 h 52 min". */
function durationOf(text: unknown, secs: unknown): string | undefined {
  const s = int(secs);
  if (s > 0) return formatDuration(String(Math.round(s / 60)));
  return formatDuration(str(text));
}

/* ---------- Película ---------- */

export type MovieDetails = {
  title: string;
  poster: string;
  backdrop: string;
  rating: string | null;
  year?: string;
  duration?: string;
  genres: string[];
  plot?: string;
  cast?: string;
  director?: string;
  ext: string;
};

export function movieDetails(raw: unknown, base: { name: string; img: string; rating: string; ext: string }): MovieDetails {
  const d = obj(raw);
  const i = obj(d.info);
  const md = obj(d.movie_data);
  return {
    title: str(i.name) || str(md.name) || base.name,
    poster: str(i.movie_image) || str(i.cover_big) || base.img,
    backdrop: firstText(i.backdrop_path),
    rating: formatRating(str(i.rating) || base.rating),
    year: yearOf(i.releasedate, i.release_date, i.year),
    duration: durationOf(i.duration, i.duration_secs),
    genres: splitList(str(i.genre)),
    plot: str(i.plot) || str(i.description) || undefined,
    cast: str(i.cast) || str(i.actors) || undefined,
    director: str(i.director) || undefined,
    ext: str(md.container_extension) || base.ext || "mp4",
  };
}

/* ---------- Serie ---------- */

export type EpisodeDetails = {
  id: string;
  season: number;
  num: number;
  title: string;
  plot?: string;
  duration?: string;
  thumb: string;
  ext: string;
};

export type SeasonDetails = { num: number; label: string; episodes: EpisodeDetails[] };

export type SeriesDetails = {
  title: string;
  cover: string;
  backdrop: string;
  rating: string | null;
  year?: string;
  genres: string[];
  plot?: string;
  cast?: string;
  director?: string;
  seasons: SeasonDetails[];
};

export const seasonLabel = (n: number) => (n === 0 ? "Especiales" : `Temporada ${n}`);

export function seriesDetails(raw: unknown, base: { name: string; img: string; rating?: string }): SeriesDetails {
  const d = obj(raw);
  const i = obj(d.info);

  const episodes: EpisodeDetails[] = [];
  const seen = new Set<string>();
  const add = (e: unknown, seasonHint: number, index: number) => {
    const o = obj(e);
    const id = str(o.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    const info = obj(o.info);
    const num = int(o.episode_num) || index + 1;
    const title = str(o.title).trim();
    episodes.push({
      id,
      season: o.season != null && str(o.season) !== "" ? int(o.season) : seasonHint,
      num,
      // Muchos paneles repiten el nombre de la serie con "S01E02" como título: no aporta.
      title: title && !/s\d+\s*e\d+/i.test(title) ? title : "",
      plot: str(info.plot) || undefined,
      duration: durationOf(info.duration, info.duration_secs),
      thumb: str(info.movie_image) || str(info.cover_big),
      ext: str(o.container_extension) || "mp4",
    });
  };

  const src = d.episodes;
  if (Array.isArray(src)) {
    src.forEach((group, g) => {
      if (Array.isArray(group)) group.forEach((e, k) => add(e, g + 1, k));
      else add(group, 1, g);
    });
  } else {
    const groups = obj(src);
    for (const key in groups) {
      const group = groups[key];
      if (Array.isArray(group)) group.forEach((e, k) => add(e, int(key), k));
    }
  }

  const bySeason = new Map<number, EpisodeDetails[]>();
  for (const e of episodes) {
    const list = bySeason.get(e.season);
    if (list) list.push(e);
    else bySeason.set(e.season, [e]);
  }
  const seasons: SeasonDetails[] = [];
  bySeason.forEach((eps, num) => seasons.push({ num, label: seasonLabel(num), episodes: eps.sort((a, b) => a.num - b.num) }));
  // Especiales (temporada 0) al final.
  seasons.sort((a, b) => (a.num === 0 ? 1 : b.num === 0 ? -1 : a.num - b.num));

  return {
    title: str(i.name) || base.name,
    cover: str(i.cover) || str(i.cover_big) || base.img,
    backdrop: firstText(i.backdrop_path),
    rating: formatRating(str(i.rating) || base.rating),
    year: yearOf(i.releaseDate, i.release_date, i.year),
    genres: splitList(str(i.genre)),
    plot: str(i.plot) || undefined,
    cast: str(i.cast) || undefined,
    director: str(i.director) || undefined,
    seasons,
  };
}

/** Todos los episodios en orden de visionado (temporadas en orden, especiales al final). */
export const allEpisodes = (s: SeriesDetails): EpisodeDetails[] => s.seasons.reduce<EpisodeDetails[]>((all, x) => all.concat(x.episodes), []);

/** "T1 · E3" */
export const episodeCode = (e: { season: number; num: number }) => (e.season === 0 ? `Especial ${e.num}` : `T${e.season} · E${e.num}`);
