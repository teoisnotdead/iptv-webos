import type { ComponentChildren } from "preact";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";
import styles from "./Button.module.css";

type Props = {
  children?: ComponentChildren;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: IconName;
  disabled?: boolean;
  autofocus?: boolean;
  /** Marca el botón como la entrada de su zona (volver a ella cae aquí). */
  isDefault?: boolean;
  selected?: boolean;
  class?: string;
  type?: "button" | "submit";
};

export function Button(p: Props) {
  return (
    <button
      type={p.type || "button"}
      data-nav
      data-nav-autofocus={p.autofocus ? "" : undefined}
      data-nav-default={p.isDefault ? "" : undefined}
      class={cx(styles.button, styles[p.variant || "secondary"], p.selected && styles.selected, p.class)}
      disabled={p.disabled}
      onClick={p.onClick}
    >
      {p.icon && <Icon name={p.icon} class={styles.icon} />}
      {p.children != null && <span>{p.children}</span>}
    </button>
  );
}
