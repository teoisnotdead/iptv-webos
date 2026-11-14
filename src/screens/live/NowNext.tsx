import { hhmm } from "../../lib/format";
import { cx } from "../../lib/cx";
import type { NowNext as Epg } from "./useEpg";
import styles from "./NowNext.module.css";

/** Programa en curso con su avance y el siguiente. No muestra nada si el canal no trae guía. */
export function NowNext({ epg, class: cls }: { epg: Epg; class?: string }) {
  const { now, next } = epg;
  if (!now) return null;
  const t = Date.now() / 1000;
  const pct = now.stop > now.start ? Math.max(0, Math.min(100, ((t - now.start) / (now.stop - now.start)) * 100)) : 0;
  return (
    <div class={cx(styles.box, cls)}>
      <div class={styles.row}>
        <span class={styles.tag}>Ahora</span>
        <span class={styles.title}>{now.title}</span>
        <span class={styles.time}>
          {hhmm(now.start)}–{hhmm(now.stop)}
        </span>
      </div>
      <div class={styles.track}>
        <div class={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      {next && (
        <div class={cx(styles.row, styles.next)}>
          <span class={styles.tag}>Después</span>
          <span class={styles.title}>{next.title}</span>
          <span class={styles.time}>{hhmm(next.start)}</span>
        </div>
      )}
    </div>
  );
}
