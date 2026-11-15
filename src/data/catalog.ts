/**
 * Cargadores del catálogo con caché en memoria y copia en el dispositivo (IndexedDB).
 * - Memoria: cada lista se pide una sola vez y la comparten todas las pantallas.
 * - Dispositivo: al abrir la app se usa la copia al instante y, si tiene más de 6 horas, se renueva
 *   en segundo plano para la próxima vez.
 * Si una carga falla, no queda cacheada. Todo va por cuenta (servidor + usuario).
 */
import { idbDeletePrefix, idbGet, idbSet } from "./idb";
import { mapList, toCategory, toChannel, toMovie, toShow, type Category, type Channel, type EpgEntry, type Movie, type Show } from "./models";
import { session } from "./session";
import { epgTitle } from "../lib/format";
import { accountKey, api, apiList, int, obj, PanelError, type Creds } from "./xtream";

const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

const mem = new Map<string, Promise<unknown>>();

function current(): Creds {
  const c = session.get();
  if (!c) throw new PanelError("Sesión vencida", "session");
  return c;
}

function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = mem.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load().catch((e) => {
      if (mem.get(key) === p) mem.delete(key);
      throw e;
    });
    mem.set(key, p);
  }
  return p;
}

type Copy<T> = { savedAt: number; items: T[] };

function readCopy<T>(key: string): Promise<Copy<T> | null> {
  return idbGet(key).then((raw) => {
    if (!raw) return null;
    try {
      const c = JSON.parse(raw) as Copy<T>;
      return c && Array.isArray(c.items) ? c : null;
    } catch {
      return null;
    }
  });
}

const writeCopy = <T>(key: string, items: T[]) => idbSet(key, JSON.stringify({ savedAt: Date.now(), items }));

/** Lista guardada en el dispositivo: usa la copia si existe y la renueva en segundo plano cuando envejece. */
function stored<T>(name: string, fetch: (c: Creds) => Promise<T[]>): Promise<T[]> {
  const creds = current();
  const key = `${accountKey(creds)}|${name}`;
  return memo(key, async () => {
    const copy = await readCopy<T>(key);
    if (copy) {
      if (Date.now() - copy.savedAt > REFRESH_AFTER_MS) {
        // Sin conexión, se queda la copia. La lista nueva se usa recién la próxima vez que se abra la app.
        fetch(creds).then((fresh) => writeCopy(key, fresh), () => undefined);
      }
      return copy.items;
    }
    const fresh = await fetch(creds);
    writeCopy(key, fresh);
    return fresh;
  });
}

/** Vacía la memoria y borra la copia de la cuenta en uso: la próxima carga va al panel. */
export function forgetCatalog(): Promise<void> {
  mem.clear();
  const c = session.get();
  return c ? idbDeletePrefix(`${accountKey(c)}|`) : Promise.resolve();
}

// Al cambiar o cerrar la cuenta, la memoria no sirve (renombrarla no la cambia).
let memAccount = session.get() ? accountKey(session.get()!) : "";
session.subscribe((c) => {
  const k = c ? accountKey(c) : "";
  if (k !== memAccount) mem.clear();
  memAccount = k;
});

export const loadLiveCategories = () => stored<Category>("live-cats", async (c) => mapList(await apiList(c, "get_live_categories"), toCategory));
export const loadChannels = () => stored<Channel>("live", async (c) => mapList(await apiList(c, "get_live_streams"), toChannel));

export const loadMovieCategories = () => stored<Category>("vod-cats", async (c) => mapList(await apiList(c, "get_vod_categories"), toCategory));
export const loadMovies = () => stored<Movie>("vod-v2", async (c) => mapList(await apiList(c, "get_vod_streams"), toMovie));

export const loadSeriesCategories = () =>
  stored<Category>("series-cats", async (c) => mapList(await apiList(c, "get_series_categories"), toCategory));
export const loadShows = () => stored<Show>("series-v2", async (c) => mapList(await apiList(c, "get_series"), toShow));

export const loadVodInfo = (id: number) => memo(`${accountKey(current())}|vod-info:${id}`, () => api(current(), "get_vod_info", { vod_id: id }));
export const loadSeriesInfo = (id: number) =>
  memo(`${accountKey(current())}|series-info:${id}`, () => api(current(), "get_series_info", { series_id: id }));

/** Guía corta de un canal (pocos programas desde ahora). Cambia con el tiempo: no se cachea. */
export async function loadShortEpg(streamId: number): Promise<EpgEntry[]> {
  let d: unknown;
  try {
    d = await api(current(), "get_short_epg", { stream_id: streamId, limit: 4 });
  } catch (e) {
    if (e instanceof PanelError && e.code === "invalid") return [];
    throw e;
  }
  const list = obj(d).epg_listings;
  if (!Array.isArray(list)) return [];
  const now = Date.now() / 1000;
  return list
    .map((x) => {
      const o = obj(x);
      return { title: epgTitle({ title: typeof o.title === "string" ? o.title : "" }), start: int(o.start_timestamp), stop: int(o.stop_timestamp) };
    })
    .filter((e) => e.title && e.stop > now)
    .sort((a, b) => a.start - b.start);
}
