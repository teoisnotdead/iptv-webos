import type { Ref } from "preact";
import { cx } from "../lib/cx";
import { Icon } from "./Icon";
import styles from "./SearchField.module.css";

type Props = {
  value: string;
  onInput: (v: string) => void;
  placeholder: string;
  autofocus?: boolean;
  small?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  class?: string;
};

/** Campo de búsqueda con lupa. En el TV, OK abre el teclado en pantalla del sistema. */
export function SearchField(p: Props) {
  return (
    <label class={cx(styles.field, p.small && styles.small, p.class)}>
      <input
        ref={p.inputRef}
        data-nav
        data-nav-autofocus={p.autofocus ? "" : undefined}
        class={styles.input}
        type="text"
        value={p.value}
        placeholder={p.placeholder}
        autocomplete="off"
        autocapitalize="none"
        spellcheck={false}
        onInput={(e) => p.onInput((e.currentTarget as HTMLInputElement).value)}
      />
      {/* Después del campo: así `:focus + .icon` lo pinta (Chromium 53 no tiene `:focus-within`). */}
      <Icon name="search" class={styles.icon} />
    </label>
  );
}
