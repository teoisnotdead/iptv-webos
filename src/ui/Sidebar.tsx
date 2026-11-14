import { useState } from "preact/hooks";
import { BRAND_NAME } from "../config";
import { cx } from "../lib/cx";
import type { Section } from "../screens/router";
import { Icon, type IconName } from "./Icon";
import styles from "./Sidebar.module.css";

const ITEMS: Array<{ id: Section; label: string; icon: IconName }> = [
  { id: "search", label: "Buscar", icon: "search" },
  { id: "home", label: "Inicio", icon: "home" },
  { id: "live", label: "En vivo", icon: "live" },
  { id: "movies", label: "Películas", icon: "movies" },
  { id: "series", label: "Series", icon: "series" },
  { id: "account", label: "Cuenta", icon: "account" },
];

/**
 * Barra lateral: angosta (solo íconos) y se abre sobre el contenido cuando recibe el foco.
 * Chromium 53 no tiene `:focus-within`: se sigue con focusin/focusout.
 */
export function Sidebar({ section, onSelect }: { section: Section; onSelect: (s: Section) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <nav
      class={cx(styles.bar, open && styles.open)}
      data-nav-zone="sidebar"
      onFocusIn={() => setOpen(true)}
      onFocusOut={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <div class={styles.brand}>
        <span class={styles.mark}>{BRAND_NAME.slice(0, 1).toUpperCase()}</span>
        <span class={styles.brandName}>{BRAND_NAME}</span>
      </div>
      <div class={styles.items}>
        {ITEMS.map((it) => (
          <button
            key={it.id}
            type="button"
            data-nav
            data-nav-default={it.id === section ? "" : undefined}
            class={cx(styles.item, it.id === section && styles.active)}
            onClick={() => onSelect(it.id)}
          >
            <Icon name={it.icon} class={styles.icon} />
            <span class={styles.label}>{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
