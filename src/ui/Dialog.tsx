import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { useBack } from "../nav/back";
import { focusInitial } from "../nav/spatial";
import styles from "./Dialog.module.css";

type Props = {
  title: string;
  children?: ComponentChildren;
  /** Botones (el que tenga `autofocus` recibe el foco). */
  actions: ComponentChildren;
  onClose: () => void;
};

/**
 * Diálogo modal: es una capa de navegación propia, así que las flechas no salen de él.
 * Atrás lo cierra y el foco vuelve a donde estaba.
 */
export function Dialog(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useBack(ref, () => p.onClose());

  useLayoutEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (ref.current) focusInitial(ref.current);
    return () => {
      if (before && document.body.contains(before)) before.focus();
    };
  }, []);

  return (
    <div class={styles.scrim} ref={ref} data-nav-layer role="dialog" aria-modal="true">
      <div class={styles.panel}>
        <h2 class={styles.title}>{p.title}</h2>
        {p.children && <div class={styles.body}>{p.children}</div>}
        <div class={styles.actions}>{p.actions}</div>
      </div>
    </div>
  );
}
