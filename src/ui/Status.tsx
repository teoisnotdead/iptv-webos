import type { ComponentChildren } from "preact";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";
import styles from "./Status.module.css";

export function Spinner({ class: cls }: { class?: string }) {
  return <span class={cx(styles.spinner, cls)} aria-label="Cargando" />;
}

/** Mensaje centrado (cargando, vacío o error), con acciones opcionales. */
export function Message(p: { icon?: IconName; title: string; text?: string; loading?: boolean; children?: ComponentChildren; class?: string }) {
  return (
    <div class={cx(styles.message, p.class)}>
      {p.loading ? <Spinner /> : p.icon && <Icon name={p.icon} class={styles.icon} />}
      <p class={styles.title}>{p.title}</p>
      {p.text && <p class={styles.text}>{p.text}</p>}
      {p.children && <div class={styles.actions}>{p.children}</div>}
    </div>
  );
}
