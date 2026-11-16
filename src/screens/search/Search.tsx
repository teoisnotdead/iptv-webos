import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { loadChannels, loadMovies, loadShows } from "../../data/catalog";
import { pushRecentSearch, useRecentSearches } from "../../data/library";
import type { Channel, Movie, Show } from "../../data/models";
import { progressMap, useProgress } from "../../data/progress";
import { formatCount as fmt } from "../../lib/format";
import { fold, MIN_QUERY, searchByName, type SearchResult } from "../../lib/search";
import { Browse, type BrowseRow } from "../../nav/Browse";
import type { CardModel, CardShape } from "../../ui/Card";
import { SearchField } from "../../ui/SearchField";
import { channelCard, movieCard, showCard } from "../cards";
import styles from "./Search.module.css";

/** Resultados por fila: para más, se afina la búsqueda. */
const ROW_MAX = 40;
/** Alto de la cabecera en rem (título, campo y estado; debe coincidir con Search.module.css). */
const HEAD_REM = 17;
/** Se busca cuando se deja de escribir un momento (el teclado del TV manda letra por letra). */
const DEBOUNCE_MS = 300;

type Lists = { channels: Channel[]; movies: Movie[]; shows: Show[]; failed: number };

/** Las listas suelen estar ya en memoria o guardadas en el TV. Si una falla, se busca en las demás. */
function loadLists(): Promise<Lists> {
  let failed = 0;
  const safe = <T,>(p: Promise<T[]>) =>
    p.catch(() => {
      failed++;
      return [] as T[];
    });
  return Promise.all([safe(loadChannels()), safe(loadMovies()), safe(loadShows())]).then(([channels, movies, shows]) => ({ channels, movies, shows, failed }));
}

/**
 * Buscar: un campo arriba y los resultados en filas (Canales, Películas, Series), como el resto de la
 * app. Sin nada escrito, muestra las últimas búsquedas que sirvieron (se guardan al elegir un resultado).
 */
export function Search() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [lists, setLists] = useState<Lists | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const recents = useRecentSearches();
  const progress = useProgress(progressMap);

  useEffect(() => {
    let alive = true;
    loadLists().then((l) => {
      if (alive) setLists(l);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const tooShort = fold(query).length < MIN_QUERY;
  const found = useMemo(() => {
    if (!lists || tooShort) return null;
    return {
      channels: searchByName(lists.channels, query, ROW_MAX),
      movies: searchByName(lists.movies, query, ROW_MAX),
      shows: searchByName(lists.shows, query, ROW_MAX),
    };
  }, [lists, query, tooShort]);

  /** Elegir una búsqueda reciente: se busca al tiro y el foco vuelve al campo (para afinarla o bajar). */
  function pick(q: string) {
    setText(q);
    setQuery(q);
    setTimeout(() => {
      if (input.current) input.current.focus();
    }, 0);
  }

  const rows = useMemo(() => {
    const out: BrowseRow[] = [];
    if (!found) {
      if (!text.trim() && recents.length) {
        out.push({
          key: "recent",
          title: "Búsquedas recientes",
          shape: "chip",
          cards: recents.map((q) => ({ key: `q-${q}`, title: q, open: () => pick(q) })),
        });
      }
      return out;
    }
    // Al abrir un resultado, la búsqueda queda entre las recientes.
    const remember = (c: CardModel): CardModel => ({
      ...c,
      open: () => {
        pushRecentSearch(query);
        c.open();
      },
    });
    const groups: Array<{ row: BrowseRow; best: number }> = [];
    const add = <T,>(key: string, title: string, shape: CardShape, r: SearchResult<T>, card: (x: T) => CardModel) => {
      if (!r.items.length) return;
      const count = r.total > r.items.length ? `${fmt(r.items.length)} de ${fmt(r.total)}` : fmt(r.total);
      groups.push({ row: { key, title, count, shape, cards: r.items.map((x) => remember(card(x))) }, best: r.best });
    };
    add("live", "Canales", "logo", found.channels, channelCard);
    add("movie", "Películas", "poster", found.movies, (m) => movieCard(m, progress));
    add("series", "Series", "poster", found.shows, showCard);
    // Primero la fila con el resultado más parecido ("nier": la serie, no las películas que solo lo contienen).
    // El índice desempata (el `sort` de Chromium 53 no es estable).
    const order = groups.map((g, i) => ({ g, i }));
    order.sort((a, b) => a.g.best - b.g.best || a.i - b.i);
    for (const o of order) out.push(o.g.row);
    return out;
  }, [found, recents, progress, text]);

  let status: string;
  if (lists && lists.failed === 3) status = "No se pudo cargar el catálogo. Revisa tu conexión.";
  else if (!text.trim()) status = "Busca canales, películas y series por su nombre.";
  else if (fold(text).length < MIN_QUERY) status = `Escribe al menos ${MIN_QUERY} letras.`;
  else if (!lists) status = "Cargando el catálogo…";
  else if (!found || query !== text.trim()) status = "Buscando…";
  else {
    const total = found.channels.total + found.movies.total + found.shows.total;
    status = total ? `${fmt(total)} ${total === 1 ? "resultado" : "resultados"}` : `No hay nada que se llame «${query}».`;
    if (lists.failed) status += " · Parte del catálogo no se pudo cargar.";
  }

  const header = (
    <div class={styles.head}>
      <h1 class={styles.title}>Buscar</h1>
      <SearchField
        value={text}
        onInput={setText}
        placeholder="Canal, película o serie"
        autofocus
        inputRef={input}
        class={styles.field}
      />
      <p class={styles.status}>{status}</p>
    </div>
  );

  return <Browse zone="search" header={header} headerRem={HEAD_REM} rows={rows} />;
}
