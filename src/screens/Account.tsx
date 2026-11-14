import { useEffect, useState } from "preact/hooks";
import { PANEL_LOCKED } from "../config";
import { forgetCatalog } from "../data/catalog";
import type { AccountInfo } from "../data/models";
import { accountInfo, logout, session } from "../data/session";
import { hostOf } from "../data/xtream";
import { daysLeft, formatDate } from "../lib/format";
import { useStore } from "../lib/store";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Spinner } from "../ui/Status";
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

/** Estado de la suscripción, renovar el catálogo guardado y cerrar sesión. */
export function Account() {
  const creds = useStore(session);
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

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

  const rows: Array<[string, string]> = [
    ["Usuario", creds.username],
    ["Estado", info ? STATUS[info.status] || info.status || "—" : failed ? "No se pudo consultar" : "…"],
    ["Vence", failed ? "—" : expiry(info)],
    ["Conexiones", info && info.maxConnections ? `${info.activeConnections} en uso de ${info.maxConnections}` : "—"],
  ];
  if (!PANEL_LOCKED) rows.push(["Servidor", hostOf(creds.url)]);

  return (
    <div class={styles.page}>
      <h1 class={styles.title}>Cuenta</h1>
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

      {confirm && (
        <Dialog
          title="¿Cerrar sesión?"
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
          Tendrás que volver a ingresar tu usuario y contraseña en este TV.
        </Dialog>
      )}
    </div>
  );
}
