import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { loadChannels, loadLiveCategories } from "../../data/catalog";
import { pushRecentChannel, toggleFavorite, useFavorites } from "../../data/library";
import type { Channel } from "../../data/models";
import { liveEngine, setLiveEngine, type LiveEngine } from "../../data/prefs";
import { session } from "../../data/session";
import { streamUrl } from "../../data/xtream";
import { byId, groupByCategory } from "../../lib/collections";
import { cx } from "../../lib/cx";
import { focusZone } from "../../nav/spatial";
import { VirtualList, type Jump } from "../../nav/VirtualList";
import { HLS_TYPE, play, playerFrame, playerState, retry, stop, type Source } from "../../player/player";
import { Button } from "../../ui/Button";
import { ChannelLogo } from "../../ui/ChannelLogo";
import { Icon } from "../../ui/Icon";
import { Message } from "../../ui/Status";
import { liveIntent } from "../router";
import { LiveFullscreen } from "./LiveFullscreen";
import { Preview } from "./Preview";
import { useNumberEntry } from "./useNumberEntry";
import styles from "./Live.module.css";

const ALL = "*";
/** Carpeta de favoritos (solo aparece si hay alguno). */
const FAV = "fav";
/** Al pasar por las carpetas, la lista de canales cambia tras esta pausa. */
const CATEGORY_DELAY_MS = 350;
/** Al hacer zapping, el canal empieza a cargar tras esta pausa (no se pide cada canal por el que se pasa). */
const ZAP_DELAY_MS = 450;

type CatItem = { id: string; name: string; count: number };

type LiveData = {
  cats: CatItem[];
  channels: Channel[];
  byCat: Map<string, Channel[]>;
  byId: Map<number, Channel>;
  catNames: Map<string, string>;
};

const formatCount = (n: number) => n.toLocaleString("es-CL");

function sourcesFor(ch: Channel, first: LiveEngine): Source[] {
  const c = session.get();
  if (!c) return [];
  const hls: Source = { url: streamUrl(c, "live", ch.id, "m3u8"), engine: "hls", type: HLS_TYPE };
  const ts: Source = { url: streamUrl(c, "live", ch.id, "ts"), engine: "ts", type: "video/mp2t" };
  return first === "ts" ? [ts, hls] : [hls, ts];
}

/**
 * TV en vivo, en tres columnas: carpetas | canales | vista previa con la guía.
 * OK en un canal lo reproduce en la vista previa; OK otra vez, a pantalla completa.
 * Los dígitos del control saltan a un número de canal.
 */
export function Live() {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [catId, setCatId] = useState(ALL);
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [full, setFull] = useState(false);
  const [jump, setJump] = useState<Jump | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const slot = useRef<HTMLDivElement>(null);
  const catTimer = useRef(0);
  const zapTimer = useRef(0);
  const noticeTimer = useRef(0);
  const seq = useRef(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    Promise.all([loadLiveCategories(), loadChannels()]).then(
      ([cats, channels]) => {
        if (!alive) return;
        const byCat = groupByCategory(channels, (c) => c.cat);
        const items: CatItem[] = [{ id: ALL, name: "Todos los canales", count: channels.length }];
        for (const c of cats) {
          const n = byCat.get(c.id)?.length || 0;
          if (n) items.push({ id: c.id, name: c.name, count: n });
        }
        setData({ cats: items, channels, byCat, byId: byId(channels), catNames: new Map(cats.map((c) => [c.id, c.name] as [string, string])) });
      },
      (e) => {
        if (alive) setError(e instanceof Error ? e.message : "No se pudo cargar el catálogo");
      },
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  // Inicio pidió un canal: se abre a pantalla completa (Atrás vuelve a la lista, en ese canal).
  useEffect(() => {
    if (!data) return;
    const id = liveIntent.get();
    if (id == null) return;
    liveIntent.set(null);
    const ch = data.byId.get(id);
    if (!ch) return;
    setCatId(ALL);
    choose(ch);
    setFull(true);
  }, [data]);

  useEffect(
    () => () => {
      clearTimeout(catTimer.current);
      clearTimeout(zapTimer.current);
      clearTimeout(noticeTimer.current);
      stop();
      playerFrame.set({ mode: "hidden" });
    },
    [],
  );

  const favIds = useFavorites("live");
  const favSet = useMemo(() => new Set(favIds), [favIds]);
  const favList = useMemo(() => (data ? favIds.map((id) => data.byId.get(id)).filter((c): c is Channel => !!c) : []), [data, favIds]);
  // Sin favoritos, la carpeta Favoritos desaparece y se vuelve a Todos.
  const cid = catId === FAV && !favList.length ? ALL : catId;
  const cats = useMemo(() => {
    if (!data || !favList.length) return data ? data.cats : [];
    return [data.cats[0], { id: FAV, name: "Favoritos", count: favList.length }].concat(data.cats.slice(1));
  }, [data, favList]);

  const list = useMemo(() => (!data ? [] : cid === ALL ? data.channels : cid === FAV ? favList : data.byCat.get(cid) || []), [data, cid, favList]);
  const catIndex = Math.max(0, cats.findIndex((c) => c.id === cid));
  const playingIndex = playing ? list.findIndex((c) => c.id === playing.id) : -1;
  const catName = (ch: Channel | null) => (ch && data ? data.catNames.get(ch.cat) || "" : "");

  // Con los datos listos, el foco entra a la lista (si no estaba en otra parte de la pantalla).
  useLayoutEffect(() => {
    if (!data) return;
    const a = document.activeElement;
    if (!a || a === document.body || a.closest('[data-nav-zone="sidebar"]')) {
      if (!focusZone("live-chs")) focusZone("live-cats");
    }
  }, [data]);

  // El video se dibuja sobre el hueco de la vista previa, o a pantalla completa.
  useLayoutEffect(() => {
    if (!playing) {
      playerFrame.set({ mode: "hidden" });
      return;
    }
    if (full) {
      playerFrame.set({ mode: "full" });
      return;
    }
    const update = () => {
      const r = slot.current?.getBoundingClientRect();
      if (r) playerFrame.set({ mode: "rect", top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, [playing ? playing.id : 0, full, !!data]);

  function start(ch: Channel, engine: LiveEngine = liveEngine()) {
    pushRecentChannel(ch.id);
    play(sourcesFor(ch, engine), { key: `live:${ch.id}`, live: true });
  }

  function choose(ch: Channel, delay = 0) {
    setPlaying(ch);
    clearTimeout(zapTimer.current);
    if (delay) zapTimer.current = window.setTimeout(() => start(ch), delay);
    else start(ch);
  }

  function flash(msg: string) {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2500);
  }

  function pickChannel(ch: Channel) {
    if (playing && playing.id === ch.id) {
      if (playerState.get().status === "error") retry();
      else setFull(true);
    } else choose(ch);
  }

  function focusCategory(c: CatItem) {
    clearTimeout(catTimer.current);
    if (c.id !== cid) catTimer.current = window.setTimeout(() => setCatId(c.id), CATEGORY_DELAY_MS);
  }

  function pickCategory(c: CatItem) {
    if (!data) return;
    clearTimeout(catTimer.current);
    const next = c.id === ALL ? data.channels : c.id === FAV ? favList : data.byCat.get(c.id) || [];
    const i = playing ? next.findIndex((x) => x.id === playing.id) : -1;
    setCatId(c.id);
    setJump({ index: Math.max(0, i), focus: true, seq: ++seq.current });
  }

  function zap(delta: number) {
    if (!list.length) return;
    const i = playingIndex >= 0 ? playingIndex : 0;
    choose(list[(i + delta + list.length) % list.length], ZAP_DELAY_MS);
  }

  function exitFull() {
    setFull(false);
    setJump({ index: Math.max(0, playingIndex), focus: true, seq: ++seq.current });
  }

  /** El usuario elige el motor: se recuerda y el canal se vuelve a cargar con él primero. */
  function chooseEngine(e: LiveEngine) {
    setLiveEngine(e);
    if (playing) start(playing, e);
  }

  function goToNumber(n: number) {
    if (!data) return;
    const ch = data.channels.find((c) => c.num === n);
    if (!ch) {
      flash(`No hay canal ${n}`);
      return;
    }
    let index = list.findIndex((c) => c.id === ch.id);
    if (index < 0) {
      setCatId(ALL);
      index = data.channels.indexOf(ch);
    }
    choose(ch);
    if (!full) setJump({ index, focus: true, seq: ++seq.current });
  }

  const digits = useNumberEntry(goToNumber, !!data);

  if (error) {
    return (
      <Message icon="alert" title="No se pudieron cargar los canales" text={error}>
        <Button variant="primary" icon="refresh" autofocus onClick={() => setReload((n) => n + 1)}>
          Reintentar
        </Button>
      </Message>
    );
  }
  if (!data) return <Message loading title="Cargando canales…" text="La primera vez puede tardar un poco." />;
  if (!data.channels.length) return <Message icon="live" title="Este servicio no tiene canales en vivo" />;

  const currentCat = cats[catIndex];

  return (
    <div class={styles.page}>
      <section class={styles.cats}>
        <h2 class={styles.heading}>Carpetas</h2>
        <VirtualList
          zone="live-cats"
          class={styles.list}
          items={cats}
          rowRem={4.75}
          initial={catIndex}
          keyOf={(c) => c.id}
          rowClass={styles.catRow}
          onFocusItem={focusCategory}
          onPick={pickCategory}
          render={(c) => (
            <span class={cx(styles.catInner, c.id === cid && styles.catCurrent)}>
              <span class={styles.catName}>{c.name}</span>
              <span class={styles.catCount}>{formatCount(c.count)}</span>
            </span>
          )}
        />
      </section>

      <section class={styles.channels}>
        <h2 class={styles.heading}>
          {currentCat ? currentCat.name : "Canales"}
          <span class={styles.headingCount}>{formatCount(list.length)} canales</span>
        </h2>
        <VirtualList
          zone="live-chs"
          class={styles.list}
          items={list}
          rowRem={5.75}
          initial={Math.max(0, playingIndex)}
          jump={jump}
          keyOf={(c) => c.id}
          rowClass={styles.chRow}
          onPick={pickChannel}
          empty={<Message icon="live" title="Carpeta vacía" />}
          render={(c) => (
            <span class={cx(styles.chInner, playing && playing.id === c.id && styles.chPlaying)}>
              <span class={styles.chNum}>{c.num > 0 ? c.num : ""}</span>
              <ChannelLogo name={c.name} src={c.logo} class={styles.chLogo} />
              <span class={styles.chName}>{c.name}</span>
              {favSet.has(c.id) && <Icon name="star" class={styles.chFav} />}
              {playing && playing.id === c.id && <Icon name="play" class={styles.chOn} />}
            </span>
          )}
        />
      </section>

      <Preview channel={playing} categoryName={catName(playing)} slotRef={slot} />

      {full && playing && (
        <LiveFullscreen
          channel={playing}
          categoryName={catName(playing)}
          favorite={favSet.has(playing.id)}
          onToggleFavorite={() => toggleFavorite("live", playing.id)}
          onExit={exitFull}
          onZap={zap}
          onEngine={chooseEngine}
        />
      )}

      {(digits || notice) && <div class={styles.numberBox}>{digits || notice}</div>}
    </div>
  );
}
