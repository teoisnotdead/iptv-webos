/** Tarjetas de cada tipo de contenido, con lo que hacen al elegirlas. */
import type { Channel, Movie, Show } from "../data/models";
import { fractionOf, type ProgressEntry, type ProgressMeta } from "../data/progress";
import { newest } from "../lib/collections";
import { formatRating, timeLeft } from "../lib/format";
import { episodeCode } from "../lib/mappers";
import type { CardModel } from "../ui/Card";
import { openMovie, openShow, playVod, watchChannel } from "./router";

export const movieCard = (m: Movie, progress?: Map<string, ProgressEntry>): CardModel => ({
  key: `m${m.id}`,
  title: m.name,
  img: m.img,
  rating: formatRating(m.rating),
  progress: progress ? fractionOf(progress.get(`movie:${m.id}`)) : 0,
  open: () => openMovie(m),
});

export const showCard = (s: Show): CardModel => ({
  key: `s${s.id}`,
  title: s.name,
  img: s.img,
  rating: formatRating(s.rating),
  open: () => openShow(s),
});

export const channelCard = (c: Channel): CardModel => ({
  key: `c${c.id}`,
  title: c.name,
  img: c.logo,
  open: () => watchChannel(c.id),
});

export function metaOf(e: ProgressEntry): ProgressMeta {
  return { kind: e.kind, id: e.id, ext: e.ext, title: e.title, img: e.img, seriesId: e.seriesId, season: e.season, ep: e.ep, epTitle: e.epTitle };
}

/** "Seguir viendo": vuelve a reproducir directo desde donde quedó. */
export const continueCard = (e: ProgressEntry): CardModel => ({
  key: `p-${e.kind}-${e.id}`,
  title: e.title,
  sub: e.seriesId && e.season != null && e.ep ? episodeCode({ season: e.season, num: e.ep }) : timeLeft(e.pos, e.dur),
  img: e.img,
  progress: fractionOf(e),
  open: () => playVod({ ...metaOf(e), resume: true }),
});

/** Destacado de portada: al azar entre lo más nuevo y bien puntuado que tenga imagen. */
export function pickFeatured<T extends { img: string; rating: string; added: number }>(items: T[]): T | null {
  if (!items.length) return null;
  const recent = newest(
    items.filter((x) => x.img),
    150,
  );
  const good = recent.filter((x) => Number(x.rating) >= 6).slice(0, 25);
  const pool = good.length ? good : recent.length ? recent.slice(0, 25) : items.slice(0, 1);
  return pool[Math.floor(Math.random() * pool.length)];
}
