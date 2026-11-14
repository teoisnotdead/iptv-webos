/**
 * Dónde quedó cada película y episodio, por cuenta y solo en este TV, para "Continuar" y "Seguir
 * viendo". Mismas reglas que la app Android: menos de 15 s no cuenta como empezado, y pasado el 95 %
 * (o a menos de 90 s del final) queda como visto y la próxima vez arranca desde el inicio.
 */
import { useMemo } from "preact/hooks";
import { createStore, useStore } from "../lib/store";
import { session } from "./session";
import { readJson, writeJson } from "./storage";
import { accountKey } from "./xtream";

export type ProgressKind = "movie" | "series";

/** Lo necesario para mostrarlo en "Seguir viendo" y volver a reproducirlo sin cargar la ficha. */
export type ProgressMeta = {
  kind: ProgressKind;
  /** id del stream (película) o del episodio. */
  id: string;
  ext: string;
  /** Nombre de la película o de la serie. */
  title: string;
  img: string;
  seriesId?: number;
  season?: number;
  ep?: number;
  /** Título del episodio. */
  epTitle?: string;
};

export type ProgressEntry = ProgressMeta & {
  /** Posición y duración, en segundos. */
  pos: number;
  dur: number;
  done: boolean;
  /** Cuándo se guardó (ms). */
  at: number;
};

const MIN_S = 15;
const END_MARGIN_S = 90;
const MAX_ENTRIES = 300;

export const progressVersion = createStore(0);

function storeKey(): string | null {
  const c = session.get();
  return c ? `iptv:progreso:${accountKey(c)}` : null;
}

function readAll(): Record<string, ProgressEntry> {
  const k = storeKey();
  if (!k) return {};
  const v = readJson<unknown>(k, {});
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, ProgressEntry>) : {};
}

function writeAll(all: Record<string, ProgressEntry>) {
  const k = storeKey();
  if (!k) return;
  const keys = Object.keys(all);
  if (keys.length > MAX_ENTRIES) {
    keys.sort((a, b) => all[a].at - all[b].at);
    for (const x of keys.slice(0, keys.length - MAX_ENTRIES)) delete all[x];
  }
  writeJson(k, all);
  progressVersion.set((n) => n + 1);
}

const entryKey = (kind: ProgressKind, id: string) => `${kind}:${id}`;

export function getProgress(kind: ProgressKind, id: string): ProgressEntry | null {
  return readAll()[entryKey(kind, id)] || null;
}

export function saveProgress(meta: ProgressMeta, pos: number, dur: number): void {
  if (!isFinite(pos) || pos < 0) return;
  const d = isFinite(dur) && dur > 0 ? dur : 0;
  const all = readAll();
  const k = entryKey(meta.kind, meta.id);
  const prev = all[k];
  const done = d > 0 && (pos >= d * 0.95 || d - pos < END_MARGIN_S);
  if (done) all[k] = { ...meta, pos: 0, dur: d, done: true, at: Date.now() };
  else if (pos < MIN_S) {
    // Volver a abrir algo ya visto y salir enseguida no borra la marca.
    if (!prev || prev.done) return;
    delete all[k];
  } else all[k] = { ...meta, pos, dur: d, done: false, at: Date.now() };
  writeAll(all);
}

/** Lo empezado y no terminado, lo último primero; de cada serie, solo su último episodio. */
export function continueWatching(limit = 20): ProgressEntry[] {
  const all = readAll();
  const list = Object.keys(all)
    .map((k) => all[k])
    .sort((a, b) => b.at - a.at);
  const out: ProgressEntry[] = [];
  const series = new Set<number>();
  for (const e of list) {
    if (e.seriesId) {
      if (series.has(e.seriesId)) continue;
      series.add(e.seriesId);
    }
    if (!e.done) out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** Todo el avance guardado, por `tipo:id` (para pintar las barritas de muchas tarjetas de una vez). */
export function progressMap(): Map<string, ProgressEntry> {
  const all = readAll();
  const out = new Map<string, ProgressEntry>();
  for (const k in all) out.set(k, all[k]);
  return out;
}

/** Avance de todos los episodios de una serie, por id de episodio. */
export function seriesProgress(seriesId: number): Map<string, ProgressEntry> {
  const all = readAll();
  const out = new Map<string, ProgressEntry>();
  for (const k in all) if (all[k].seriesId === seriesId) out.set(all[k].id, all[k]);
  return out;
}

/** Fracción vista (0 a 1) para la barrita de las tarjetas. */
export const fractionOf = (e: ProgressEntry | null | undefined) => (e && !e.done && e.dur > 0 ? Math.min(1, e.pos / e.dur) : 0);

/** Vuelve a calcular algo cuando cambia el avance guardado. */
export function useProgress<T>(read: () => T, deps: unknown[] = []): T {
  const v = useStore(progressVersion);
  const s = useStore(session);
  return useMemo(read, [v, s, ...deps]);
}
