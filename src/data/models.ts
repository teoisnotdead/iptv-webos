/**
 * Modelos compactos del catálogo: solo los campos que la app usa. Así las listas pesan poco en
 * memoria (el TV tiene poca) y en la copia guardada en el dispositivo.
 */
import { int, obj, str } from "./xtream";

export type Category = { id: string; name: string };

export type Channel = {
  id: number;
  /** Número del canal en el panel (0 si no trae). */
  num: number;
  name: string;
  logo: string;
  cat: string;
};

/** `added`: cuándo se agregó al panel (segundos; 0 si no viene), para "Recientes". */
export type Movie = { id: number; name: string; img: string; rating: string; cat: string; ext: string; added: number };

export type Show = { id: number; name: string; img: string; rating: string; cat: string; added: number };

export function toCategory(raw: unknown): Category | null {
  const o = obj(raw);
  const id = str(o.category_id);
  return id ? { id, name: str(o.category_name) || "Sin nombre" } : null;
}

export function toChannel(raw: unknown): Channel | null {
  const o = obj(raw);
  const id = int(o.stream_id);
  if (!id) return null;
  return { id, num: int(o.num), name: str(o.name).trim() || `Canal ${id}`, logo: str(o.stream_icon), cat: str(o.category_id) };
}

export function toMovie(raw: unknown): Movie | null {
  const o = obj(raw);
  const id = int(o.stream_id);
  if (!id) return null;
  return {
    id,
    name: str(o.name).trim() || `Película ${id}`,
    img: str(o.stream_icon),
    rating: str(o.rating),
    cat: str(o.category_id),
    ext: str(o.container_extension) || "mp4",
    added: int(o.added),
  };
}

export function toShow(raw: unknown): Show | null {
  const o = obj(raw);
  const id = int(o.series_id);
  if (!id) return null;
  return { id, name: str(o.name).trim() || `Serie ${id}`, img: str(o.cover), rating: str(o.rating), cat: str(o.category_id), added: int(o.last_modified) };
}

/** Mapea una lista cruda descartando lo inválido y los ids repetidos (hay paneles que repiten ítems). */
export function mapList<T extends { id: number | string }>(raw: unknown[], map: (x: unknown) => T | null): T[] {
  const seen = new Set<number | string>();
  const out: T[] = [];
  for (const r of raw) {
    const x = map(r);
    if (x && !seen.has(x.id)) {
      seen.add(x.id);
      out.push(x);
    }
  }
  return out;
}

/** Estado de la cuenta (respuesta de `player_api.php` sin acción). */
export type AccountInfo = {
  auth: number;
  status: string;
  username: string;
  expDate: number | null;
  maxConnections: number;
  activeConnections: number;
};

export function toAccount(raw: unknown): AccountInfo {
  const u = obj(obj(raw).user_info);
  const exp = int(u.exp_date);
  return {
    auth: int(u.auth),
    status: str(u.status),
    username: str(u.username),
    expDate: exp > 0 ? exp : null,
    maxConnections: int(u.max_connections),
    activeConnections: int(u.active_cons),
  };
}

export type EpgEntry = { title: string; start: number; stop: number };
