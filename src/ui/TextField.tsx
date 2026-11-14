import { cx } from "../lib/cx";
import styles from "./TextField.module.css";

type Props = {
  label: string;
  value: string;
  onInput: (v: string) => void;
  type?: "text" | "password" | "url";
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  autofocus?: boolean;
};

/** Campo de texto. En el TV, OK abre el teclado en pantalla del sistema. */
export function TextField(p: Props) {
  return (
    <label class={cx(styles.field, p.invalid && styles.invalid)}>
      <span class={styles.label}>{p.label}</span>
      <input
        data-nav
        data-nav-autofocus={p.autofocus ? "" : undefined}
        class={styles.input}
        type={p.type || "text"}
        value={p.value}
        placeholder={p.placeholder}
        disabled={p.disabled}
        autocomplete="off"
        autocapitalize="none"
        spellcheck={false}
        onInput={(e) => p.onInput((e.currentTarget as HTMLInputElement).value)}
      />
    </label>
  );
}
