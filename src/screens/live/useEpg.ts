import { useEffect, useState } from "preact/hooks";
import { loadShortEpg } from "../../data/catalog";
import type { EpgEntry } from "../../data/models";

export type NowNext = { now: EpgEntry | null; next: EpgEntry | null };

const EMPTY: NowNext = { now: null, next: null };
const DELAY_MS = 700;
const REFRESH_MS = 120_000;

function pick(list: EpgEntry[]): NowNext {
  const t = Date.now() / 1000;
  const i = list.findIndex((e) => e.start <= t && e.stop > t);
  if (i < 0) return EMPTY;
  return { now: list[i], next: list[i + 1] || null };
}

/**
 * Ahora/después del canal en curso. Espera un momento tras cambiar de canal (al hacer zapping no
 * vale la pena pedir la guía de cada canal que pasa) y se renueva cada 2 minutos.
 * Solo una minoría de canales trae guía: sin datos, devuelve vacío.
 */
export function useEpg(streamId: number | null): NowNext {
  const [epg, setEpg] = useState<NowNext>(EMPTY);
  useEffect(() => {
    setEpg(EMPTY);
    if (!streamId) return;
    let alive = true;
    let list: EpgEntry[] = [];
    const fetch = () => {
      loadShortEpg(streamId).then(
        (l) => {
          if (!alive) return;
          list = l;
          setEpg(pick(list));
        },
        () => undefined,
      );
    };
    const first = setTimeout(fetch, DELAY_MS);
    const every = setInterval(fetch, REFRESH_MS);
    // El programa en curso cambia aunque no se pida la guía de nuevo.
    const tick = setInterval(() => alive && list.length && setEpg(pick(list)), 30_000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(every);
      clearInterval(tick);
    };
  }, [streamId]);
  return epg;
}
