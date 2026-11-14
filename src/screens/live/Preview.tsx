import type { Ref } from "preact";
import type { Channel } from "../../data/models";
import { useStore } from "../../lib/store";
import { playerState } from "../../player/player";
import { ChannelLogo } from "../../ui/ChannelLogo";
import { Icon } from "../../ui/Icon";
import { Spinner } from "../../ui/Status";
import { NowNext } from "./NowNext";
import { useEpg } from "./useEpg";
import styles from "./Live.module.css";

const ENGINE_LABEL = { hls: "HLS", ts: "MPEG-TS", file: "" } as const;

/**
 * Columna derecha: el hueco donde se dibuja el video (`slot`, lo mide la pantalla) y los datos
 * del canal con la guía.
 */
export function Preview({ channel, categoryName, slotRef }: { channel: Channel | null; categoryName: string; slotRef: Ref<HTMLDivElement> }) {
  const st = useStore(playerState);
  const epg = useEpg(channel ? channel.id : null);

  return (
    <section class={styles.preview}>
      <div class={styles.slot} ref={slotRef}>
        {!channel && (
          <div class={styles.slotHint}>
            <Icon name="play" class={styles.slotIcon} />
            <span>Elige un canal y presiona OK para verlo aquí</span>
          </div>
        )}
        {channel && st.status === "loading" && (
          <div class={styles.slotOverlay}>
            <Spinner />
          </div>
        )}
        {channel && st.status === "error" && (
          <div class={styles.slotOverlay}>
            <div class={styles.slotError}>
              <Icon name="alert" class={styles.slotIcon} />
              <strong>{st.error}</strong>
              <span>Presiona OK otra vez para reintentar</span>
            </div>
          </div>
        )}
      </div>

      {channel && (
        <div class={styles.info}>
          <div class={styles.infoHead}>
            <ChannelLogo name={channel.name} src={channel.logo} class={styles.infoLogo} />
            <div class={styles.infoTitles}>
              <div class={styles.infoName}>
                {channel.num > 0 && <span class={styles.infoNum}>{channel.num}</span>}
                {channel.name}
              </div>
              <div class={styles.infoMeta}>
                {categoryName}
                {st.engine && st.status === "playing" && ENGINE_LABEL[st.engine] ? ` · ${ENGINE_LABEL[st.engine]}` : ""}
              </div>
            </div>
          </div>
          <NowNext epg={epg} />
          <p class={styles.infoHint}>OK otra vez para verlo en pantalla completa</p>
        </div>
      )}
    </section>
  );
}
