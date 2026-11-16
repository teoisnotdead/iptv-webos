import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { loadMovieCategories, loadMovies, loadSeriesCategories, loadSeriesInfo, loadShows, loadVodInfo } from "../../data/catalog";
import { useFavorites } from "../../data/library";
import type { Category, Movie, Show } from "../../data/models";
import { getProgress, progressMap, useProgress } from "../../data/progress";
import { byId, groupByCategory, newest } from "../../lib/collections";
import { cx } from "../../lib/cx";
import { formatCount as fmt } from "../../lib/format";
import { movieDetails, seriesDetails } from "../../lib/mappers";
import { searchByName } from "../../lib/search";
import { useAsync } from "../../lib/useAsync";
import { useBack } from "../../nav/back";
import { Browse, type BrowseRow } from "../../nav/Browse";
import { useFocusWhenReady } from "../../nav/layer";
import { focusInitial } from "../../nav/spatial";
import { VirtualGrid } from "../../nav/VirtualGrid";
import { VirtualList } from "../../nav/VirtualList";
import { Button } from "../../ui/Button";
import type { CardModel } from "../../ui/Card";
import { Dialog } from "../../ui/Dialog";
import { Hero } from "../../ui/Hero";
import { SearchField } from "../../ui/SearchField";
import { Message } from "../../ui/Status";
import { movieCard, pickFeatured, showCard } from "../cards";
import { openMovie, openShow, playVod } from "../router";
import styles from "./Catalog.module.css";

export type VodKind = "movie" | "series";
type Item = Movie | Show;

const ROW_MAX = 30;
const HERO_REM = 35;
const NO_CAT = "";
const GRID_DEBOUNCE_MS = 250;

type CatItem = { id: string; name: string; count: number };
type Data = { cats: CatItem[]; items: Item[]; byCat: Map<string, Item[]> };

/**
 * Películas o Series, estilo Netflix: portada destacada, "Recientes", "Mi lista" y una fila por
 * categoría (las primeras 30 + "Ver todas"). "Ver todas" y el botón Categorías abren la categoría
 * completa en una grilla; Atrás vuelve a las filas donde estabas.
 */
export function Catalog({ kind }: { kind: VodKind }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [grid, setGrid] = useState<CatItem | null>(null);
  const [gridText, setGridText] = useState("");
  const [gridQuery, setGridQuery] = useState("");
  const [picker, setPicker] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridField = useRef<HTMLInputElement>(null);
  const beforeGrid = useRef<HTMLElement | null>(null);
  const pickerFrom = useRef<HTMLElement | null>(null);

  const favs = useFavorites(kind);
  const progress = useProgress(progressMap);
  const noun = kind === "movie" ? "películas" : "series";

  useEffect(() => {
    let alive = true;
    setError(false);
    const cats = kind === "movie" ? loadMovieCategories() : loadSeriesCategories();
    const items: Promise<Item[]> = kind === "movie" ? loadMovies() : loadShows();
    Promise.all([cats, items]).then(
      ([cs, list]) => {
        if (!alive) return;
        const byCat = groupByCategory<Item>(list, (x) => x.cat);
        const out: CatItem[] = [];
        const known = new Set<string>();
        for (const c of cs as Category[]) {
          known.add(c.id);
          const n = byCat.get(c.id)?.length || 0;
          if (n) out.push({ id: c.id, name: c.name, count: n });
        }
        // Lo que no tiene categoría conocida va a "Otras".
        const orphans = list.filter((x) => !known.has(x.cat));
        if (orphans.length) {
          byCat.set(NO_CAT, orphans);
          out.push({ id: NO_CAT, name: "Otras", count: orphans.length });
        }
        setData({ cats: out, items: list, byCat });
      },
      () => {
        if (alive) setError(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [kind, reload]);

  const card = (x: Item): CardModel => (kind === "movie" ? movieCard(x as Movie, progress) : showCard(x as Show));
  const open = (x: Item) => (kind === "movie" ? openMovie(x as Movie) : openShow(x as Show));

  /** `from`: dónde vuelve el foco al cerrar la grilla (por defecto, lo que tiene el foco ahora). */
  function openGrid(c: CatItem, from?: HTMLElement | null) {
    beforeGrid.current = from || (document.activeElement as HTMLElement | null);
    setGridText("");
    setGridQuery("");
    setGrid(c);
  }

  // El filtro de la categoría se aplica cuando se deja de escribir un momento.
  useEffect(() => {
    const t = setTimeout(() => setGridQuery(gridText.trim()), GRID_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [gridText]);

  function openPicker() {
    pickerFrom.current = document.activeElement as HTMLElement | null;
    setPicker(true);
  }

  function closeGrid() {
    setGrid(null);
    const before = beforeGrid.current;
    setTimeout(() => {
      if (before && document.body.contains(before)) before.focus();
    }, 0);
  }

  useBack(gridRef, closeGrid, !!grid);

  // Al abrir una categoría, el foco entra a la grilla.
  useLayoutEffect(() => {
    if (grid && gridRef.current) focusInitial(gridRef.current);
  }, [grid]);

  const featured = useMemo(() => (data ? pickFeatured<Item>(data.items) : null), [data]);
  const info = useAsync<unknown>(
    () => (featured ? (kind === "movie" ? loadVodInfo(featured.id) : loadSeriesInfo(featured.id)) : Promise.resolve(null)),
    [featured],
  );

  // Fijo por catálogo: las filas se rearman cada vez que se guarda el avance de un video.
  const fixed = useMemo(() => (data ? { recent: newest(data.items, ROW_MAX), byId: byId(data.items) } : null), [data]);

  const rows = useMemo(() => {
    if (!data || !fixed) return [];
    const out: BrowseRow[] = [];
    out.push({ key: "new", title: "Recientes", shape: "poster", cards: fixed.recent.map(card) });
    if (favs.length) {
      const m = fixed.byId;
      const mine = favs.map((id) => m.get(id)).filter((x): x is Item => !!x);
      if (mine.length) out.push({ key: "mine", title: "Mi lista", shape: "poster", cards: mine.map(card) });
    }
    for (const c of data.cats) {
      const list = data.byCat.get(c.id) || [];
      const cards = list.slice(0, ROW_MAX).map(card);
      if (list.length > ROW_MAX) cards.push({ key: `more-${c.id}`, title: `Ver todas: ${c.name}`, more: list.length, open: () => openGrid(c) });
      out.push({ key: `cat-${c.id}`, title: c.name, count: fmt(c.count), shape: "poster", cards });
    }
    return out;
  }, [data, fixed, favs, progress]);

  const gridCards = useMemo(() => {
    if (!grid || !data) return [];
    const list = data.byCat.get(grid.id) || [];
    return (gridQuery ? searchByName(list, gridQuery).items : list).map(card);
  }, [grid, data, progress, gridQuery]);

  useFocusWhenReady(!!data || error);

  if (error) {
    return (
      <Message icon="alert" title={`No se pudieron cargar las ${noun}`} text="Revisa tu conexión e inténtalo de nuevo.">
        <Button variant="primary" icon="refresh" autofocus onClick={() => setReload((n) => n + 1)}>
          Reintentar
        </Button>
      </Message>
    );
  }
  if (!data) return <Message loading title={`Cargando ${noun}…`} text="La primera vez puede tardar un poco." />;
  if (!data.items.length) return <Message icon={kind === "movie" ? "movies" : "series"} title={`Este servicio no tiene ${noun}`} />;

  let hero = null;
  if (featured && kind === "movie") {
    const m = featured as Movie;
    const d = movieDetails(info.value, m);
    const prog = getProgress("movie", String(m.id));
    hero = (
      <Hero eyebrow="Destacado · Película" title={d.title} rating={d.rating} meta={[d.year, d.duration].concat(d.genres.slice(0, 2))} plot={d.plot} backdrop={d.backdrop} poster={d.poster}>
        <Button variant="primary" icon="play" autofocus onClick={() => playVod({ kind: "movie", id: String(m.id), ext: d.ext, title: d.title, img: m.img, resume: true })}>
          {prog && !prog.done ? "Continuar" : "Reproducir"}
        </Button>
        <Button icon="info" onClick={() => open(m)}>
          Más información
        </Button>
        <Button icon="grid" onClick={openPicker}>
          Categorías
        </Button>
      </Hero>
    );
  } else if (featured) {
    const s = featured as Show;
    const d = seriesDetails(info.value, s);
    hero = (
      <Hero eyebrow="Destacado · Serie" title={d.title} rating={d.rating} meta={[d.year].concat(d.genres.slice(0, 2))} plot={d.plot} backdrop={d.backdrop} poster={d.cover}>
        <Button variant="primary" icon="play" autofocus onClick={() => open(s)}>
          Ver serie
        </Button>
        <Button icon="grid" onClick={openPicker}>
          Categorías
        </Button>
      </Hero>
    );
  }

  return (
    <div class={styles.page}>
      <div class={cx(styles.fill, grid && styles.gone)}>
        <Browse zone={kind} header={hero} headerRem={HERO_REM} rows={rows} />
      </div>

      {grid && (
        <div class={styles.gridPage} ref={gridRef}>
          <div class={styles.gridHead}>
            <h1 class={styles.gridTitle}>
              {grid.name}
              <span class={styles.gridCount}>
                {gridQuery ? `${fmt(gridCards.length)} de ${fmt(grid.count)}` : fmt(grid.count)} {noun}
              </span>
            </h1>
            <SearchField
              small
              value={gridText}
              onInput={setGridText}
              placeholder="Buscar en esta categoría"
              inputRef={gridField}
              class={styles.gridSearch}
            />
          </div>
          {gridQuery && !gridCards.length && <p class={styles.gridEmpty}>No hay nada que se llame «{gridQuery}» en esta categoría.</p>}
          <VirtualGrid
            key={grid.id}
            items={gridCards}
            shape="poster"
            zone={`${kind}-grid`}
            class={styles.grid}
            onUpFromTop={() => {
              if (gridField.current) gridField.current.focus();
            }}
          />
        </div>
      )}

      {picker && (
        <Dialog title="Categorías" onClose={() => setPicker(false)} actions={<Button onClick={() => setPicker(false)}>Cerrar</Button>}>
          <div class={styles.pickerList}>
            <VirtualList
              zone="cat-picker"
              items={data.cats}
              rowRem={4.5}
              keyOf={(c) => c.id}
              rowClass={styles.pickRow}
              onPick={(c) => {
                setPicker(false);
                openGrid(c, pickerFrom.current);
              }}
              render={(c) => (
                <span class={styles.pickInner}>
                  <span class={styles.pickName}>{c.name}</span>
                  <span class={styles.pickCount}>{fmt(c.count)}</span>
                </span>
              )}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
