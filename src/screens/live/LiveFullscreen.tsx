import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Channel } from "../../data/models";
import type { LiveEngine } from "../../data/prefs";
import { cx } from "../../lib/cx";
import { useStore } from "../../lib/store";
import { useBack, useKeys } from "../../nav/back";
import { navKey } from "../../nav/keys";
import { focusInitial } from "../../nav/spatial";
import { AudioPicker } from "../../player/AudioPicker";
import { playerState, retry } from "../../player/player";
import { Button } from "../../ui/Button";
import { ChannelLogo } from "../../ui/ChannelLogo";
import { Spinner } from "../../ui/Status";
import { Icon } from "../../ui/Icon";
import { NowNext } from "./NowNext";
import { useEpg } from "./useEpg";
import styles from "./LiveFullscreen.module.css";

const HIDE_MS = 5000;

type Props = {
  channel: Channel;
  categoryName: string;
  favorite: boolean;
  onToggleFavorite: () => void;
  onExit: () => void;
  onZap: (delta: number) => void;
  onEngine: (e: LiveEngine) => void;
};

/**
 * Canal a pantalla completa. ▲/CH+ y ▼/CH− cambian de canal dentro de la carpeta; OK o las flechas
 * laterales muestran la barra con la guía y las opciones (HLS/TS, audio); Atrás la oculta y, sin
 * barra, vuelve a la lista.
 */
export function LiveFullscreen(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useStore(playerState);
  const epg = useEpg(p.channel.id);
  const [bar, setBar] = useState(true);
  const [audioOpen, setAudioOpen] = useState(false);
  const timer = useRef(0);

  const keepBar = st.status === "loading" || st.status === "error";

  function showBar() {
    setBar(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBar(false), HIDE_MS);
  }

  function hideBar() {
    clearTimeout(timer.current);
    setBar(false);
  }

  // El foco entra a la capa: si se quedara en la lista de atrás, la lista se tragaría las flechas.
  useLayoutEffect(() => {
    if (ref.current) focusInitial(ref.current);
  }, []);

  useEffect(() => {
    showBar();
  }, [p.channel.id]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const visible = bar || keepBar;

  useBack(ref, () => {
    if (visible && !keepBar) hideBar();
    else p.onExit();
  });

  useKeys((e) => {
    if (e.defaultPrevented) return;
    const k = navKey(e);
    if (!k) return;
    if (k === "up" || k === "chup") {
      e.preventDefault();
      p.onZap(1);
    } else if (k === "down" || k === "chdown") {
      e.preventDefault();
      p.onZap(-1);
    } else if (k === "stop") {
      e.preventDefault();
      p.onExit();
    } else if (k === "info") {
      e.preventDefault();
      if (bar) hideBar();
      else showBar();
    } else if (k === "ok" || k === "left" || k === "right") {
      const focusInside = ref.current && ref.current.contains(document.activeElement);
      if (!visible || !focusInside) {
        e.preventDefault();
        showBar();
        // Al aparecer la barra, el foco va a su primer botón.
        setTimeout(() => {
          if (ref.current) focusInitial(ref.current);
        }, 0);
      } else showBar();
    }
  }, !audioOpen);

  const engine = st.engine === "ts" ? "ts" : st.engine === "hls" ? "hls" : null;

  return (
    <div class={styles.layer} ref={ref} data-nav-layer>
      {st.status === "loading" && (
        <div key="loading" class={styles.center}>
          <Spinner />
        </div>
      )}

      <div key="bar" class={cx(styles.bar, !visible && styles.hidden)}>
        <div class={styles.head}>
          <ChannelLogo name={p.channel.name} src={p.channel.logo} class={styles.logo} />
          <div class={styles.titles}>
            <div class={styles.name}>
              {p.channel.num > 0 && <span class={styles.num}>{p.channel.num}</span>}
              {p.channel.name}
            </div>
            <div class={styles.meta}>{p.categoryName}</div>
          </div>
        </div>

        {st.status === "error" ? (
          <div class={styles.error}>
            <Icon name="alert" class={styles.errorIcon} />
            <span>{st.error}</span>
          </div>
        ) : (
          <NowNext epg={epg} class={styles.epg} />
        )}

        <div class={styles.actions}>
          {st.status === "error" && (
            <Button variant="primary" icon="refresh" autofocus onClick={() => retry()}>
              Reintentar
            </Button>
          )}
          <Button selected={engine === "hls"} autofocus={st.status !== "error"} onClick={() => p.onEngine("hls")}>
            HLS
          </Button>
          <Button selected={engine === "ts"} onClick={() => p.onEngine("ts")}>
            TS
          </Button>
          {st.tracks.length > 1 && (
            <Button icon="audio" onClick={() => setAudioOpen(true)}>
              Audio
            </Button>
          )}
          <Button icon={p.favorite ? "star" : "starOutline"} selected={p.favorite} onClick={p.onToggleFavorite}>
            {p.favorite ? "Favorito" : "Agregar a favoritos"}
          </Button>
          <span class={styles.hint}>Arriba/abajo o CH+/CH− cambian de canal · Atrás vuelve</span>
        </div>
      </div>

      {audioOpen && <AudioPicker tracks={st.tracks} onClose={() => setAudioOpen(false)} />}
    </div>
  );
}
