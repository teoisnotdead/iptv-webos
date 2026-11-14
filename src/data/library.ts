/**
 * Lo personal de cada cuenta, guardado solo en este TV: favoritos (canales, películas y series) y
 * los últimos canales vistos. Las listas van de lo más nuevo a lo más viejo.
 */
import { useMemo } from "preact/hooks";
import { createStore, useStore } from "../lib/store";
import { session } from "./session";
import { readJson, writeJson } from "./storage";
import { accountKey } from "./xtream";

export type FavKind = "live" | "movie" | "series";

const MAX_FAVORITES = 500;
const MAX_RECENT = 20;

/** Cambia cada vez que se toca una lista: las pantallas lo observan para refrescarse. */
export const libraryVersion = createStore(0);
const bump = () => libraryVersion.set((n) => n + 1);

function keyOf(list: string): string | null {
  const c = session.get();
  return c ? `iptv:${list}:${accountKey(c)}` : null;
}

function readIds(list: string): number[] {
  const k = keyOf(list);
  if (!k) return [];
  const v = readJson<unknown>(k, []);
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
}

function writeIds(list: string, ids: number[]) {
  const k = keyOf(list);
  if (!k) return;
  writeJson(k, ids);
  bump();
}

export const favoriteIds = (kind: FavKind) => readIds(`favoritos:${kind}`);

/** Agrega o quita un favorito. Devuelve si quedó como favorito. */
export function toggleFavorite(kind: FavKind, id: number): boolean {
  const ids = favoriteIds(kind);
  const i = ids.indexOf(id);
  if (i >= 0) ids.splice(i, 1);
  else ids.unshift(id);
  writeIds(`favoritos:${kind}`, ids.slice(0, MAX_FAVORITES));
  return i < 0;
}

export const recentChannelIds = () => readIds("recientes:live");

export function pushRecentChannel(id: number): void {
  const ids = recentChannelIds().filter((x) => x !== id);
  ids.unshift(id);
  writeIds("recientes:live", ids.slice(0, MAX_RECENT));
}

/** Favoritos de un tipo, actualizados al cambiar. */
export function useFavorites(kind: FavKind): number[] {
  const v = useStore(libraryVersion);
  const s = useStore(session);
  return useMemo(() => favoriteIds(kind), [v, s, kind]);
}

export function useRecentChannels(): number[] {
  const v = useStore(libraryVersion);
  const s = useStore(session);
  return useMemo(recentChannelIds, [v, s]);
}
