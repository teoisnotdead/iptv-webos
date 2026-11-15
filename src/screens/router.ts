/**
 * Navegación entre pantallas.
 * - `section`: lo que se ve junto a la barra lateral (Inicio, En vivo, Películas…).
 * - `overlays`: pantallas que tapan todo encima de la sección (ficha de película o serie, reproductor).
 *   Se apilan: Atrás cierra la de arriba y la de abajo sigue como estaba (foco incluido).
 */
import type { Movie, Show } from "../data/models";
import type { ProgressMeta } from "../data/progress";
import { session } from "../data/session";
import { accountKey } from "../data/xtream";
import { createStore } from "../lib/store";

export type Section = "home" | "search" | "live" | "movies" | "series" | "account";

export const section = createStore<Section>("home");

/** Qué reproducir (película o episodio). `resume`: seguir desde donde quedó, si quedó a medias. */
export type PlayRequest = ProgressMeta & { resume: boolean };

type OverlayBody = { type: "movie"; movie: Movie } | { type: "series"; show: Show } | { type: "play"; req: PlayRequest };
export type Overlay = { key: number } & OverlayBody;

export const overlays = createStore<Overlay[]>([]);

let seq = 0;
const push = (o: OverlayBody) => overlays.set((list) => list.concat([{ ...o, key: ++seq }]));

export const openMovie = (movie: Movie) => push({ type: "movie", movie });
export const openShow = (show: Show) => push({ type: "series", show });
export const playVod = (req: PlayRequest) => push({ type: "play", req });

export function closeOverlay(key: number): void {
  overlays.set((list) => list.filter((o) => o.key !== key));
}

/** Canal que En vivo debe abrir a pantalla completa al cargar (lo pide Inicio). */
export const liveIntent = createStore<number | null>(null);

export function watchChannel(id: number): void {
  liveIntent.set(id);
  overlays.set([]);
  section.set("live");
}

/** "Agregar cuenta" abierto (el login, encima de la cuenta en uso). */
export const addingAccount = createStore(false);

// Otra cuenta (o cerrar sesión): se parte de cero. Renombrar la cuenta en uso no cuenta como otra.
let current = session.get() ? accountKey(session.get()!) : "";
session.subscribe((c) => {
  const k = c ? accountKey(c) : "";
  if (k === current) return;
  current = k;
  overlays.set([]);
  section.set("home");
  liveIntent.set(null);
});
