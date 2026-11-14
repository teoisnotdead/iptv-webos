import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { BRAND_NAME } from "./config";
import { session, verifySession } from "./data/session";
import { accountKey } from "./data/xtream";
import { cx } from "./lib/cx";
import { useStore } from "./lib/store";
import { setBackFallback } from "./nav/back";
import { focusInitial, focusZone } from "./nav/spatial";
import { stop } from "./player/player";
import { VideoHost } from "./player/VideoHost";
import { VodPlayer } from "./player/VodPlayer";
import { Account } from "./screens/Account";
import { Home } from "./screens/home/Home";
import { Live } from "./screens/live/Live";
import { Login } from "./screens/Login";
import { overlays, section, type Overlay } from "./screens/router";
import { Soon } from "./screens/Soon";
import { Catalog } from "./screens/vod/Catalog";
import { MovieDetail } from "./screens/vod/MovieDetail";
import { SeriesDetail } from "./screens/vod/SeriesDetail";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { Sidebar } from "./ui/Sidebar";
import styles from "./App.module.css";

/** Cierra la app. En webOS, `window.close()`; si el sistema no la cierra, vuelve al inicio del TV. */
function exitApp() {
  stop();
  window.close();
  setTimeout(() => {
    const back = (window.webOS && window.webOS.platformBack) || (window.PalmSystem && window.PalmSystem.platformBack);
    if (back) back.call(window.webOS || window.PalmSystem);
  }, 300);
}

export function App() {
  const creds = useStore(session);
  const [exit, setExit] = useState(false);

  // Al abrir la app, confirmar que la cuenta guardada siga activa.
  useEffect(() => {
    verifySession();
  }, []);

  // Atrás sin nadie que lo tome: desde el contenido va a la barra lateral; desde ahí (o en el login), salir.
  useEffect(() => {
    setBackFallback(() => {
      const a = document.activeElement;
      const inSidebar = a && a.closest('[data-nav-zone="sidebar"]');
      if (session.get() && !inSidebar && focusZone("sidebar")) return;
      setExit(true);
    });
  }, []);

  return (
    <>
      {creds ? <Shell key={accountKey(creds)} /> : <Login />}
      <VideoHost />
      {exit && (
        <Dialog
          title={`¿Salir de ${BRAND_NAME}?`}
          onClose={() => setExit(false)}
          actions={
            <>
              <Button autofocus onClick={() => setExit(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={exitApp}>
                Salir
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

function Shell() {
  const sec = useStore(section);
  const ovs = useStore(overlays);
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Al elegir una sección en la barra, el foco pasa al contenido (si ya hay algo que enfocar; si no,
  // lo hace la sección al terminar de cargar).
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (main.current) focusInitial(main.current);
  }, [sec]);

  return (
    <div class={styles.shell} data-nav-layer>
      <Sidebar section={sec} onSelect={(s) => section.set(s)} />
      {/* Tapada por una ficha o el reproductor: sigue montada (recuerda dónde estabas) pero no se ve. */}
      <main class={cx(styles.main, ovs.length > 0 && styles.covered)} ref={main}>
        {sec === "home" && <Home />}
        {sec === "live" && <Live />}
        {sec === "movies" && <Catalog key="movie" kind="movie" />}
        {sec === "series" && <Catalog key="series" kind="series" />}
        {sec === "search" && <Soon icon="search" title="Buscar" />}
        {sec === "account" && <Account />}
      </main>
      {ovs.map((o, i) => (
        <OverlayView key={o.key} o={o} covered={i < ovs.length - 1} />
      ))}
    </div>
  );
}

/** Una capa encima de la sección. Las que quedan tapadas por otra siguen montadas pero ocultas. */
function OverlayView({ o, covered }: { o: Overlay; covered: boolean }) {
  return (
    <div class={cx(covered && styles.covered)}>
      {o.type === "movie" && <MovieDetail movie={o.movie} okey={o.key} />}
      {o.type === "series" && <SeriesDetail show={o.show} okey={o.key} />}
      {o.type === "play" && <VodPlayer req={o.req} okey={o.key} />}
    </div>
  );
}
