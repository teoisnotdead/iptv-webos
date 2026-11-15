import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { PANEL_LOCKED, PANEL_URL } from "../config";
import { login, LoginError, loginNotice } from "../data/session";
import { useStore } from "../lib/store";
import { useBack } from "../nav/back";
import { focusInitial } from "../nav/spatial";
import { BrandMark, Wordmark } from "../ui/Brand";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import styles from "./Login.module.css";

/**
 * Ingreso con los datos de la suscripción. No hay `<form>`: en el TV, OK sobre un campo abre el
 * teclado en pantalla, y en un formulario también lo enviaría. Se entra con el botón.
 * Con `onClose` es "agregar cuenta" (ya hay una en uso): se puede cancelar, y se cierra al agregarla.
 */
export function Login({ onClose }: { onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const notice = useStore(loginNotice);
  const adding = !!onClose;
  const [name, setName] = useState("");
  const [url, setUrl] = useState(PANEL_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  useLayoutEffect(() => {
    if (ref.current) focusInitial(ref.current);
  }, []);

  // Agregando otra cuenta, Atrás vuelve a la app sin agregarla.
  useBack(ref, () => {
    if (onClose && !busy) onClose();
  }, adding);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login({ url, username, password, name });
      if (onClose) onClose();
    } catch (e) {
      setError(e instanceof LoginError ? e : new LoginError("unreachable", "No se pudo iniciar sesión. Inténtalo de nuevo."));
      setBusy(false);
    }
  }

  const code = error?.code;

  return (
    <div class={styles.page} ref={ref} data-nav-layer>
      <div class={styles.panel}>
        <h1 class={styles.brand}>
          <BrandMark class={styles.mark} />
          <Wordmark />
        </h1>
        <p class={styles.lead}>{adding ? "Agrega otra cuenta a este TV" : "Ingresa con los datos de tu suscripción"}</p>
        {notice && !error && !adding && <p class={styles.notice}>{notice}</p>}

        {/* Arriba, pero el foco empieza en el usuario: casi nadie le pone nombre a la primera cuenta. */}
        <TextField label="Nombre de la cuenta (opcional)" value={name} onInput={setName} placeholder="Casa, Familia, Trabajo…" disabled={busy} />

        {!PANEL_LOCKED && (
          <TextField
            label="Servidor"
            type="url"
            value={url}
            onInput={setUrl}
            placeholder="http://servidor:8080"
            invalid={code === "bad_url" || code === "unreachable"}
            disabled={busy}
            autofocus={!PANEL_URL}
          />
        )}
        <TextField
          label="Usuario"
          value={username}
          onInput={setUsername}
          placeholder="Tu usuario"
          invalid={code === "invalid"}
          disabled={busy}
          autofocus={PANEL_LOCKED || !!PANEL_URL}
        />
        <TextField label="Contraseña" type="password" value={password} onInput={setPassword} placeholder="Tu contraseña" invalid={code === "invalid"} disabled={busy} />

        {error && <p class={styles.error}>{error.message}</p>}

        <Button variant="primary" class={styles.submit} disabled={busy} onClick={submit}>
          {busy ? (adding ? "Agregando…" : "Entrando…") : adding ? "Agregar cuenta" : "Entrar"}
        </Button>
        {adding ? (
          <Button variant="ghost" class={styles.cancel} disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
        ) : (
          <p class={styles.help}>En el control, OK sobre un campo abre el teclado.</p>
        )}
      </div>
    </div>
  );
}
