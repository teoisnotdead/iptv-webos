import { useEffect, useState } from "preact/hooks";
import { hueOf, initials } from "../lib/format";
import { cx } from "../lib/cx";
import styles from "./ChannelLogo.module.css";

/** Logo del canal (directo del panel); si falta o no carga, sus iniciales sobre un color estable. */
export function ChannelLogo({ name, src, class: cls }: { name: string; src: string; class?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    const h = hueOf(name);
    return (
      <span class={cx(styles.logo, styles.initials, cls)} style={{ background: `hsl(${h}, 30%, 24%)` }}>
        {initials(name)}
      </span>
    );
  }
  return (
    <span class={cx(styles.logo, cls)}>
      <img class={styles.img} src={src} alt="" onError={() => setFailed(true)} />
    </span>
  );
}
