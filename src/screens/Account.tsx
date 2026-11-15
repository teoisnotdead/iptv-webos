import { useEffect, useState } from "preact/hooks";
import { PANEL_LOCKED } from "../config";
import { forgetCatalog } from "../data/catalog";
import type { AccountInfo } from "../data/models";
import { accountInfo, accountLabel, accounts, logout, rename, session, switchTo } from "../data/session";
import { accountKey, hostOf, type Creds } from "../data/xtream";
import { cx } from "../lib/cx";
import { daysLeft, formatDate } from "../lib/format";
import { useStore } from "../lib/store";
import { stop } from "../player/player";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Status";
import { TextField } from "../ui/TextField";
import { addingAccount } from "./router";
import styles from "./Account.module.css";

const STATUS: Record<string, string> = {
  Active: "Activa",
  Expired: "Vencida",
  Banned: "Deshabilitada",
  Disabled: "Deshabilitada",
};

function expiry(info: AccountInfo | null): string {
  if (!info) return "—";
  if (!info.expDate) return "Sin vencimiento";
  const d = daysLeft(info.expDate);
  const when = formatDate(info.expDate);
  if (d == null) return when;
  if (d < 0) return `Venció el ${when}`;
  return d === 0 ? `${when} (hoy)` : `${when} (en ${d} ${d === 1 ? "día" : "días"})`;
}

/**
 * Estado de la suscripción, las cuentas guardadas en este TV (cambiar, renombrar, agregar), renovar
 * el catálogo guardado y cerrar sesión. Como en la app Android.
 */
export function Account() {
  const creds = useStore(session);
  const list = useStore(accounts);
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  // Cuenta que se está renombrando (null = diálogo cerrado) y el nombre que se va escribiendo.
  const [renaming, setRenaming] = useState<Creds | null>(null);
  const [draft, setDraft] = useState("");

  // La pantalla se monta de nuevo con cada cuenta (la app entera va con la clave de la cuenta).
  useEffect(() => {
    let alive = true;
    accountInfo().then(
      (i) => alive && setInfo(i),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!creds) return null;
  const active = accountKey(creds);

  const rows: Array<[string, string]> = [];
  if (creds.name) rows.push(["Nombre", creds.name]);
  rows.push(
    ["Usuario", creds.username],
    ["Estado", info ? STATUS[info.status] || info.status || "—" : failed ? "No se pudo consultar" : "…"],
    ["Vence", failed ? "—" : expiry(info)],
    ["Conexiones", info && info.maxConnections ? `${info.activeConnections} en uso de ${info.maxConnections}` : "—"],
  );
  if (!PANEL_LOCKED) rows.push(["Servidor", hostOf(creds.url)]);

  const others = list.length - 1;

  return (
    <div class={styles.page}>
      <h1 class={styles.title}>Cuenta</h1>
      <div class={styles.columns}>
        <div class={styles.main}>
          <dl class={styles.rows}>
            {rows.map(([k, v]) => (
              <div class={styles.row} key={k}>
                <dt>{k}</dt>
                <dd>{v === "…" ? <Spinner class={styles.spinner} /> : v}</dd>
              </div>
            ))}
          </dl>

          <div class={styles.actions}>
            <Button
              icon="refresh"
              autofocus
              onClick={() => {
                forgetCatalog().then(() => setRefreshed(true));
              }}
            >
              Actualizar catálogo
            </Button>
            <Button icon="logout" onClick={() => setConfirm(true)}>
              Cerrar sesión
            </Button>
          </div>
          {refreshed && <p class={styles.note}>Listo: los canales, películas y series se volverán a descargar al abrirlos.</p>}
        </div>

        <section class={styles.side}>
          <h2 class={styles.heading}>Cuentas en este TV</h2>
          <div class={styles.list}>
            {list.map((a) => {
              const key = accountKey(a);
              const current = key === active;
              const detail = [a.name ? a.username : "", PANEL_LOCKED ? "" : hostOf(a.url)].filter(Boolean).join(" · ");
              return (
                <div class={styles.account} key={key}>
                  <button
                    type="button"
                    data-nav
                    class={cx(styles.pick, current && styles.current)}
                    onClick={() => {
                      if (current) return;
                      stop();
                      switchTo(a);
                    }}
                  >
                    <span class={styles.avatar}>
                      <Icon name="account" />
                    </span>
                    <span class={styles.who}>
                      <span class={styles.label}>{accountLabel(a)}</span>
                      {detail && <span class={styles.detail}>{detail}</span>}
                    </span>
                    {current && (
                      <span class={styles.inUse}>
                        <Icon name="check" />
                        En uso
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    data-nav
                    class={styles.rename}
                    onClick={() => {
                      setDraft(a.name || "");
                      setRenaming(a);
                    }}
                  >
                    <Icon name="edit" />
                    Renombrar
                  </button>
                </div>
              );
            })}
            <button type="button" data-nav class={styles.add} onClick={() => addingAccount.set(true)}>
              <Icon name="plus" />
              Agregar cuenta
            </button>
          </div>
        </section>
      </div>

      {renaming && (
        <Dialog
          title="Nombre de la cuenta"
          onClose={() => setRenaming(null)}
          actions={
            <>
              <Button onClick={() => setRenaming(null)}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={() => {
                  rename(renaming, draft);
                  setRenaming(null);
                }}
              >
                Guardar
              </Button>
            </>
          }
        >
          <p class={styles.hint}>Solo se guarda en este TV. Déjalo vacío para mostrar el usuario ({renaming.username}).</p>
          <TextField label="Nombre" value={draft} onInput={setDraft} placeholder="Casa, Familia, Trabajo…" autofocus />
        </Dialog>
      )}

      {confirm && (
        <Dialog
          title={`¿Cerrar sesión de ${accountLabel(creds)}?`}
          onClose={() => setConfirm(false)}
          actions={
            <>
              <Button onClick={() => setConfirm(false)} autofocus>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => forgetCatalog().then(() => logout())}>
                Cerrar sesión
              </Button>
            </>
          }
        >
          {others > 0
            ? `La cuenta se quita de este TV y pasas a ${others === 1 ? "la otra cuenta guardada" : "otra de las cuentas guardadas"}.`
            : "Tendrás que volver a ingresar tu usuario y contraseña en este TV."}
        </Dialog>
      )}
    </div>
  );
}
