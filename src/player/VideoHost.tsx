import { useEffect, useRef } from "preact/hooks";
import { cx } from "../lib/cx";
import { useStore } from "../lib/store";
import { attachVideo, playerFrame } from "./player";
import styles from "./VideoHost.module.css";

/**
 * El `<video>` único de la app, encima de la interfaz (el TV dibuja el video en un plano aparte y
 * abre un "hueco" donde está el elemento). Se posiciona con top/left/width/height, nunca con
 * transform: el plano de video del TV no sigue transformaciones CSS.
 */
export function VideoHost() {
  const ref = useRef<HTMLVideoElement>(null);
  const frame = useStore(playerFrame);

  useEffect(() => {
    if (ref.current) return attachVideo(ref.current);
  }, []);

  const style =
    frame.mode === "rect"
      ? { top: `${frame.top}px`, left: `${frame.left}px`, width: `${frame.width}px`, height: `${frame.height}px` }
      : frame.mode === "full"
        ? { top: "0", left: "0", width: "100%", height: "100%" }
        : { top: "0", left: "0", width: "1px", height: "1px", visibility: "hidden" as const };

  return (
    <>
      {frame.mode === "full" && <div class={styles.backdrop} />}
      <video ref={ref} class={cx(styles.video, frame.mode === "full" && styles.full)} style={style} playsInline preload="auto" />
    </>
  );
}
