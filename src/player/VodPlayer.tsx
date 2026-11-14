import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { loadSeriesInfo } from "../data/catalog";
import { getProgress, saveProgress, type ProgressMeta } from "../data/progress";
import { setSubtitleLanguage } from "../data/prefs";
import { session } from "../data/session";
import { streamUrl } from "../data/xtream";
import { cx } from "../lib/cx";
import { clock } from "../lib/format";
import { allEpisodes, episodeCode, seriesDetails } from "../lib/mappers";
import { useStore } from "../lib/store";
import { useBack, useKeys } from "../nav/back";
import { navKey } from "../nav/keys";
import { useLayerFocus } from "../nav/layer";
import { focusEl } from "../nav/spatial";
import { closeOverlay, type PlayRequest } from "../screens/router";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Status";
import { AudioPicker } from "./AudioPicker";
import { pause, play, playerFrame, playerState, playerTime, resume, retry, seek, selectText, stop, togglePause, videoTime } from "./player";
import { trackLabel } from "./tracks";
import styles from "./VodPlayer.module.css";

const HIDE_MS = 4500;
/** Cada cuánto se guarda el avance mientras se reproduce. */
const SAVE_EVERY_S = 10;
/** Cuenta regresiva antes de pasar solo al siguiente episodio. */
const UP_NEXT_S = 10;
/** Las pulsaciones seguidas de ← → se juntan y se salta una sola vez al final. */
const SEEK_COMMIT_MS = 700;
/** Un panel lento puede tardar en empezar a mandar una película grande. */
const START_TIMEOUT_MS = 30_000;

const metaOf = (r: PlayRequest): ProgressMeta => ({
  kind: r.kind,
  id: r.id,
  ext: r.ext,
  title: r.title,
  img: r.img,
  seriesId: r.seriesId,
  season: r.season,
  ep: r.ep,
  epTitle: r.epTitle,
});

function subtitleOf(r: PlayRequest): string {
  if (r.kind !== "series" || r.season == null || !r.ep) return "";
  const code = episodeCode({ season: r.season, num: r.ep });
  return r.epTitle ? `${code} · ${r.epTitle}` : code;
}

/**
 * Película o episodio a pantalla completa, con el `<video>` único de la app.
 * ← → adelantan o retroceden (10 s, y más rápido si se mantiene), OK pausa, ↑ ↓ muestran los
 * controles, y las teclas de reproducción del control funcionan siempre. Atrás oculta los controles y,
 * sin controles, vuelve a la ficha. El avance se guarda cada 10 s y al salir.
 */
export function VodPlayer({ req, okey }: { req: PlayRequest; okey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLButtonElement>(null);
  const [cur, setCur] = useState<PlayRequest>(req);
  const curRef = useRef(cur);
  curRef.current = cur;
  const st = useStore(playerState);
  const time = useStore(playerTime);

  const [bar, setBar] = useState(true);
  const hideTimer = useRef(0);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const seekState = useRef({ target: 0, steps: 0, timer: 0 });
  const [picker, setPicker] = useState<"audio" | "text" | null>(null);
  const [next, setNext] = useState<PlayRequest | null>(null);
  const [upNext, setUpNext] = useState<number | null>(null);
  const lastSaved = useRef(0);

  useLayoutEffect(() => {
    playerFrame.set({ mode: "full" });
    return () => {
      playerFrame.set({ mode: "hidden" });
    };
  }, []);
  useLayerFocus(ref);

  function save() {
    const { t, d } = videoTime();
    if (d <= 0 || playerState.get().status === "error") return;
    saveProgress(metaOf(curRef.current), t, d);
    lastSaved.current = t;
  }

  function exit() {
    save();
    closeOverlay(okey);
  }

  function showBar() {
    setBar(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setBar(false), HIDE_MS);
    // Al reaparecer, el foco vuelve a la barra de avance si se había perdido.
    setTimeout(() => {
      if (ref.current && !ref.current.contains(document.activeElement)) focusEl(slider.current);
    }, 0);
  }

  function hideBar() {
    clearTimeout(hideTimer.current);
    setBar(false);
  }

  // Arranca lo que toca (y busca el episodio siguiente para el final).
  useEffect(() => {
    const c = session.get();
    if (!c) return;
    const p = getProgress(cur.kind, cur.id);
    const startAt = cur.resume && p && !p.done ? p.pos : 0;
    lastSaved.current = startAt;
    setNext(null);
    setUpNext(null);
    play([{ url: streamUrl(c, cur.kind, cur.id, cur.ext), engine: "file" }], {
      key: `${cur.kind}:${cur.id}`,
      live: false,
      startAt,
      startTimeoutMs: START_TIMEOUT_MS,
      onEnded: () => onEnded.current(),
    });
    showBar();

    if (cur.kind !== "series" || !cur.seriesId) return;
    let alive = true;
    loadSeriesInfo(cur.seriesId).then(
      (raw) => {
        if (!alive) return;
        const eps = allEpisodes(seriesDetails(raw, { name: cur.title, img: cur.img }));
        const i = eps.findIndex((e) => e.id === cur.id);
        const n = i >= 0 ? eps[i + 1] : undefined;
        if (n) setNext({ ...metaOf(cur), id: n.id, ext: n.ext, season: n.season, ep: n.num, epTitle: n.title, resume: true });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [cur]);

  // Al salir: guardar dónde quedó y soltar el video.
  useEffect(
    () => () => {
      save();
      stop();
      clearTimeout(hideTimer.current);
      clearTimeout(seekState.current.timer);
    },
    [],
  );

  // Guardado periódico.
  useEffect(() => {
    if (st.status === "playing" && Math.abs(time.t - lastSaved.current) >= SAVE_EVERY_S) save();
  }, [time.t]);

  const nextRef = useRef(next);
  nextRef.current = next;
  const onEnded = useRef(() => undefined as void);
  onEnded.current = () => {
    const { d } = videoTime();
    if (d > 0) saveProgress(metaOf(curRef.current), d, d);
    if (nextRef.current) setUpNext(UP_NEXT_S);
    else closeOverlay(okey);
  };

  function playNext() {
    const n = nextRef.current;
    if (!n) return;
    save();
    setUpNext(null);
    setCur(n);
  }

  // Cuenta regresiva del siguiente episodio.
  useEffect(() => {
    if (upNext == null) return;
    if (upNext <= 0) {
      playNext();
      return;
    }
    const t = window.setTimeout(() => setUpNext((n) => (n == null ? n : n - 1)), 1000);
    return () => {
      clearTimeout(t);
    };
  }, [upNext]);

  function seekStep(dir: 1 | -1, fixed?: number) {
    const s = seekState.current;
    const { t, d } = videoTime();
    if (s.timer) clearTimeout(s.timer);
    else {
      s.target = t;
      s.steps = 0;
    }
    s.steps++;
    const step = fixed || (s.steps > 12 ? 60 : s.steps > 5 ? 30 : 10);
    s.target = Math.max(0, d > 0 ? Math.min(d - 2, s.target + dir * step) : s.target + dir * step);
    setSeekTo(s.target);
    showBar();
    s.timer = window.setTimeout(() => {
      s.timer = 0;
      seek(s.target);
      setSeekTo(null);
    }, SEEK_COMMIT_MS);
  }

  const status = st.status;
  const visible = bar || status === "paused" || status === "loading" || status === "error" || seekTo != null;

  // Si falla, el foco pasa a "Reintentar" (la barra de avance se oculta).
  useEffect(() => {
    if (status !== "error" || !ref.current) return;
    focusEl(ref.current.querySelector<HTMLElement>(`.${styles.errorBox} [data-nav]`));
  }, [status]);

  useBack(ref, () => {
    if (upNext != null) {
      setUpNext(null);
      exit();
    } else if (visible && status === "playing" && seekTo == null) hideBar();
    else exit();
  });

  useKeys(
    (e) => {
      if (e.defaultPrevented || upNext != null) return;
      const k = navKey(e);
      if (!k) return;
      const onSlider = document.activeElement === slider.current;
      if (k === "play" || k === "pause" || k === "playpause") {
        e.preventDefault();
        if (k === "play") resume();
        else if (k === "pause") pause();
        else togglePause();
        showBar();
      } else if (k === "stop") {
        e.preventDefault();
        exit();
      } else if (k === "ff" || k === "rw") {
        e.preventDefault();
        seekStep(k === "ff" ? 1 : -1, 30);
      } else if (k === "left" || k === "right") {
        if (!visible || onSlider) {
          e.preventDefault();
          if (status === "playing" || status === "paused") seekStep(k === "right" ? 1 : -1);
          else showBar();
        } else showBar();
      } else if (k === "up" || k === "down") {
        if (!visible) {
          e.preventDefault();
          showBar();
        } else showBar();
      } else if (k === "ok") {
        if (!visible || onSlider) {
          e.preventDefault();
          if (status === "playing" || status === "paused") togglePause();
          showBar();
        } else showBar();
      }
    },
    picker == null,
  );

  const shown = seekTo != null ? seekTo : time.t;
  const pct = time.d > 0 ? Math.min(100, (shown / time.d) * 100) : 0;
  const sub = subtitleOf(cur);

  return (
    <div class={styles.layer} ref={ref} data-nav-layer>
      {(status === "loading" || (st.buffering && status === "playing")) && (
        <div key="loading" class={styles.center}>
          <Spinner class={styles.spinner} />
        </div>
      )}
      {status === "paused" && seekTo == null && (
        <div key="paused" class={styles.center}>
          <span class={styles.bigIcon}>
            <Icon name="pause" />
          </span>
        </div>
      )}

      {status === "error" && (
        <div key="error" class={styles.center}>
          <div class={styles.errorBox}>
            <Icon name="alert" class={styles.errorIcon} />
            <strong>{st.error}</strong>
            <span>Puede que el servidor no responda o que el TV no soporte este formato.</span>
            <div class={styles.errorActions}>
              <Button variant="primary" icon="refresh" autofocus onClick={() => retry()}>
                Reintentar
              </Button>
              <Button onClick={exit}>Volver</Button>
            </div>
          </div>
        </div>
      )}

      <div key="top" class={cx(styles.top, !visible && styles.hidden)}>
        <div class={styles.title}>{cur.title}</div>
        {sub && <div class={styles.sub}>{sub}</div>}
      </div>

      <div key="bottom" class={cx(styles.bottom, (!visible || status === "error") && styles.hidden)}>
        <div class={styles.timeline}>
          <span class={styles.time}>{clock(shown)}</span>
          <button type="button" ref={slider} data-nav data-nav-autofocus class={styles.slider} aria-label="Avance">
            <span class={styles.track}>
              <span class={styles.fill} style={{ width: `${pct}%` }} />
              <span class={styles.knob} style={{ left: `${pct}%` }} />
              {seekTo != null && (
                <span class={styles.seekLabel} style={{ left: `${pct}%` }}>
                  {clock(seekTo)}
                </span>
              )}
            </span>
          </button>
          <span class={styles.time}>{time.d > 0 ? clock(time.d) : "--:--"}</span>
        </div>

        <div class={styles.actions}>
          <Button icon={status === "paused" ? "play" : "pause"} onClick={() => togglePause()}>
            {status === "paused" ? "Reproducir" : "Pausa"}
          </Button>
          {st.tracks.length > 1 && (
            <Button icon="audio" onClick={() => setPicker("audio")}>
              Audio
            </Button>
          )}
          {st.texts.length > 0 && (
            <Button icon="subtitles" onClick={() => setPicker("text")}>
              Subtítulos
            </Button>
          )}
          {next && (
            <Button icon="next" onClick={playNext}>
              Siguiente episodio
            </Button>
          )}
          <span class={styles.hint}>← → adelantar · OK pausa · Atrás salir</span>
        </div>
      </div>

      {upNext != null && next && (
        <div key="upnext" class={styles.upNext}>
          <span class={styles.upNextLabel}>Siguiente episodio en {upNext} s</span>
          <strong class={styles.upNextTitle}>{subtitleOf(next)}</strong>
          <div class={styles.upNextActions}>
            <UpNextButtons onPlay={playNext} onCancel={exit} />
          </div>
        </div>
      )}

      {picker === "audio" && <AudioPicker tracks={st.tracks} onClose={() => setPicker(null)} />}
      {picker === "text" && <SubtitlePicker onClose={() => setPicker(null)} />}
    </div>
  );
}

/** Botones de "siguiente episodio": toman el foco al aparecer. */
function UpNextButtons({ onPlay, onCancel }: { onPlay: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const b = ref.current && ref.current.querySelector<HTMLElement>("[data-nav]");
    if (b) b.focus();
  }, []);
  return (
    <div ref={ref} class={styles.upNextButtons}>
      <Button variant="primary" icon="play" onClick={onPlay}>
        Ver ahora
      </Button>
      <Button onClick={onCancel}>Salir</Button>
    </div>
  );
}

function SubtitlePicker({ onClose }: { onClose: () => void }) {
  const st = useStore(playerState);
  const none = !st.texts.some((t) => t.showing);
  return (
    <Dialog title="Subtítulos" onClose={onClose} actions={<Button onClick={onClose}>Cerrar</Button>}>
      <div class={styles.pickList}>
        <Button
          icon={none ? "check" : undefined}
          selected={none}
          autofocus={none}
          class={styles.pickItem}
          onClick={() => {
            selectText(-1);
            setSubtitleLanguage("off");
            onClose();
          }}
        >
          Desactivados
        </Button>
        {st.texts.map((t) => (
          <Button
            key={t.index}
            icon={t.showing ? "check" : undefined}
            selected={t.showing}
            autofocus={t.showing}
            class={styles.pickItem}
            onClick={() => {
              selectText(t.index);
              if (t.language) setSubtitleLanguage(t.language);
              onClose();
            }}
          >
            {trackLabel({ index: t.index, label: t.label, language: t.language, enabled: t.showing })}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}
