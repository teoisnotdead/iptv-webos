/**
 * Reproductor único de la app. El TV tiene un solo decodificador por hardware: hay un único `<video>`
 * (lo monta `VideoHost`) que se mueve entre la vista previa y la pantalla completa sin remontarse.
 *
 * El video va directo del panel al reproductor del TV (que decodifica AC-3/E-AC-3, y DTS en MKV).
 * `play()` recibe fuentes en orden de preferencia: si una falla o no arranca a tiempo, prueba la siguiente.
 * Las URLs llevan credenciales: nunca van a mensajes ni a la consola.
 */
import { createStore } from "../lib/store";
import { audioLanguage, subtitleLanguage } from "../data/prefs";

export const HLS_TYPE = "application/vnd.apple.mpegurl";

export type Engine = "hls" | "ts" | "file";

export type Source = { url: string; engine: Engine; type?: string };

/** Dónde se dibuja el video: oculto, en un rectángulo (vista previa, en px de la pantalla) o completo. */
export type Frame = { mode: "hidden" } | { mode: "rect"; top: number; left: number; width: number; height: number } | { mode: "full" };

export type AudioTrackInfo = { index: number; label: string; language: string; enabled: boolean };
export type TextTrackInfo = { index: number; label: string; language: string; showing: boolean };

export type PlayerState = {
  status: "idle" | "loading" | "playing" | "paused" | "error";
  /** Reproduciendo pero esperando datos (después de adelantar, red lenta). */
  buffering: boolean;
  /** Motor de la fuente en curso. */
  engine: Engine | null;
  error: string | null;
  /** Identifica lo que se está reproduciendo (p. ej. `live:123`). */
  key: string | null;
  tracks: AudioTrackInfo[];
  texts: TextTrackInfo[];
};

const IDLE: PlayerState = { status: "idle", buffering: false, engine: null, error: null, key: null, tracks: [], texts: [] };

export const playerState = createStore<PlayerState>(IDLE);
export const playerFrame = createStore<Frame>({ mode: "hidden" });
/** Posición y duración en segundos (se actualiza unas 4 veces por segundo). */
export const playerTime = createStore<{ t: number; d: number }>({ t: 0, d: 0 });

const patch = (p: Partial<PlayerState>) => playerState.set((s) => ({ ...s, ...p }));

/** Si en este tiempo no empezó a reproducir, se pasa a la siguiente fuente. */
const START_TIMEOUT_MS = 12_000;
/** En vivo: si se queda cargando este tiempo, se recarga la fuente. */
const STALL_TIMEOUT_MS = 15_000;
const MAX_STALL_RELOADS = 3;

let video: HTMLVideoElement | null = null;
let sources: Source[] = [];
let current = -1;
let attempt = 0;
let live = false;
let startTimeoutMs = START_TIMEOUT_MS;
/** Posición donde arrancar (VOD); se aplica al cargar los metadatos. */
let startAt = 0;
let pendingStart = 0;
let startTimer = 0;
let stallTimer = 0;
let stallReloads = 0;
let onSourceOk: ((s: Source) => void) | null = null;
let onEndedCb: (() => void) | null = null;
let destroyHls: (() => void) | null = null;

function clearTimers() {
  clearTimeout(startTimer);
  clearTimeout(stallTimer);
  startTimer = stallTimer = 0;
}

function detach() {
  if (destroyHls) {
    destroyHls();
    destroyHls = null;
  }
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  while (video.firstChild) video.removeChild(video.firstChild);
  // Libera el decodificador del TV.
  video.load();
}

function readTracks(): AudioTrackInfo[] {
  const list = video?.audioTracks;
  if (!list) return [];
  const out: AudioTrackInfo[] = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    out.push({ index: i, label: t.label || "", language: t.language || "", enabled: t.enabled });
  }
  return out;
}

function readTexts(): TextTrackInfo[] {
  const list = video?.textTracks;
  if (!list) return [];
  const out: TextTrackInfo[] = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (t.kind === "subtitles" || t.kind === "captions") out.push({ index: i, label: t.label || "", language: t.language || "", showing: t.mode === "showing" });
  }
  return out;
}

function syncTracks() {
  patch({ tracks: readTracks(), texts: readTexts() });
}

/** Al cargar un video, activa las pistas del idioma que el usuario eligió antes (si existen). */
function applyPreferredTracks() {
  const lang = audioLanguage();
  const list = video?.audioTracks;
  if (lang && list && list.length > 1) {
    let match = -1;
    for (let i = 0; i < list.length; i++) if (list[i].language === lang) match = i;
    if (match >= 0 && !list[match].enabled) selectAudio(match);
  }
  const sub = subtitleLanguage();
  if (sub && sub !== "off") {
    const texts = readTexts();
    const t = texts.find((x) => x.language === sub);
    if (t && !t.showing) selectText(t.index);
  }
}

export function selectAudio(index: number): void {
  const list = video?.audioTracks;
  if (!list || !list[index]) return;
  for (let i = 0; i < list.length; i++) list[i].enabled = i === index;
  syncTracks();
}

/** Muestra una pista de subtítulos (índice de `textTracks`), o ninguna con -1. */
export function selectText(index: number): void {
  const list = video?.textTracks;
  if (!list) return;
  for (let i = 0; i < list.length; i++) list[i].mode = i === index ? "showing" : "disabled";
  syncTracks();
}

async function load(s: Source, my: number) {
  if (!video) return;
  detach();
  pendingStart = startAt;
  // En Chrome de escritorio (solo al desarrollar) HLS no es nativo: se usa hls.js. Nunca entra al build del TV.
  if (import.meta.env.DEV && s.engine === "hls" && !video.canPlayType(HLS_TYPE)) {
    const { default: Hls } = await import("hls.js");
    if (my !== attempt || !video) return;
    const hls = new Hls();
    hls.on(Hls.Events.ERROR, (_e, d) => {
      if (d.fatal && my === attempt) next(my);
    });
    hls.loadSource(s.url);
    hls.attachMedia(video);
    destroyHls = () => hls.destroy();
  } else if (s.type) {
    // Con `<source type>` el TV elige bien el reproductor aunque el panel redirija a una URL sin extensión.
    const el = document.createElement("source");
    el.src = s.url;
    el.type = s.type;
    el.addEventListener("error", () => {
      if (my === attempt) next(my);
    });
    video.appendChild(el);
    video.load();
  } else {
    video.src = s.url;
  }
  const p = video.play();
  if (p && typeof p.catch === "function") p.catch(() => undefined);
}

function tryAt(i: number, my: number) {
  if (my !== attempt) return;
  clearTimers();
  if (i >= sources.length) {
    detach();
    patch({ status: "error", buffering: false, error: live ? "No se pudo reproducir este canal." : "No se pudo reproducir este video.", engine: null });
    return;
  }
  current = i;
  stallReloads = 0;
  patch({ status: "loading", buffering: false, engine: sources[i].engine, error: null, tracks: [], texts: [] });
  startTimer = window.setTimeout(() => next(my), startTimeoutMs);
  load(sources[i], my);
}

function next(my: number) {
  if (my === attempt) tryAt(current + 1, my);
}

export type PlayOptions = {
  key: string;
  live: boolean;
  /** Segundos desde donde arrancar (películas y episodios). */
  startAt?: number;
  /** Cuánto esperar a que arranque antes de probar la siguiente fuente. */
  startTimeoutMs?: number;
  /** Se llama cuando una fuente arranca (p. ej. para recordar el motor que funcionó). */
  onSourceOk?: (s: Source) => void;
  /** Fin del video (no en vivo). */
  onEnded?: () => void;
};

export function play(list: Source[], opts: PlayOptions): void {
  sources = list;
  live = opts.live;
  startAt = opts.startAt && opts.startAt > 0 ? opts.startAt : 0;
  startTimeoutMs = opts.startTimeoutMs || START_TIMEOUT_MS;
  onSourceOk = opts.onSourceOk || null;
  onEndedCb = opts.onEnded || null;
  const my = ++attempt;
  playerTime.set({ t: startAt, d: 0 });
  patch({ key: opts.key });
  tryAt(0, my);
}

/** Vuelve a intentar desde la primera fuente (botón Reintentar). En VOD, desde donde iba. */
export function retry(): void {
  if (!sources.length) return;
  if (!live && playerTime.get().t > 0) startAt = playerTime.get().t;
  const my = ++attempt;
  tryAt(0, my);
}

export function stop(): void {
  attempt++;
  clearTimers();
  sources = [];
  current = -1;
  onEndedCb = null;
  detach();
  playerState.set(IDLE);
  playerTime.set({ t: 0, d: 0 });
}

export function togglePause(): void {
  if (!video || playerState.get().status === "idle") return;
  if (video.paused) resume();
  else video.pause();
}

export function resume(): void {
  if (!video) return;
  const p = video.play();
  if (p && typeof p.catch === "function") p.catch(() => undefined);
}

export function pause(): void {
  if (video) video.pause();
}

/** Salta a una posición (segundos). */
export function seek(t: number): void {
  if (!video) return;
  const d = video.duration;
  const to = Math.max(0, isFinite(d) && d > 0 ? Math.min(t, d - 1) : t);
  video.currentTime = to;
  playerTime.set({ t: to, d: isFinite(d) ? d : 0 });
}

/** Posición y duración actuales, leídas directo del video. */
export function videoTime(): { t: number; d: number } {
  if (!video) return { t: 0, d: 0 };
  const d = video.duration;
  return { t: video.currentTime || 0, d: isFinite(d) ? d : 0 };
}

/** Lo llama `VideoHost` al montar el `<video>`. */
export function attachVideo(el: HTMLVideoElement): () => void {
  video = el;
  const my = () => attempt;

  const onPlaying = () => {
    clearTimers();
    const s = sources[current];
    if (s && onSourceOk) onSourceOk(s);
    patch({ status: "playing", buffering: false, error: null });
    applyPreferredTracks();
    syncTracks();
  };
  const onPause = () => {
    if (playerState.get().status === "playing") patch({ status: "paused", buffering: false });
  };
  const onMetadata = () => {
    if (pendingStart > 0) {
      const d = el.duration;
      if (!isFinite(d) || pendingStart < d - 5) el.currentTime = pendingStart;
      pendingStart = 0;
    }
    syncTracks();
  };
  const onTime = () => {
    const d = isFinite(el.duration) ? el.duration : 0;
    const prev = playerTime.get();
    if (Math.abs(prev.t - el.currentTime) >= 0.2 || prev.d !== d) playerTime.set({ t: el.currentTime, d });
  };
  /** En vivo: si en un rato no avanzó, recarga la fuente (y tras varias veces, prueba la siguiente). */
  const armStallTimer = () => {
    if (!live || playerState.get().status !== "playing") return;
    clearTimeout(stallTimer);
    const at = my();
    const t = el.currentTime;
    stallTimer = window.setTimeout(() => {
      if (at !== attempt) return;
      // `stalled` (y a veces `waiting`) llega aunque el video siga avanzando: solo se recarga si se detuvo.
      if (!el.paused && el.currentTime > t + 1) return;
      if (stallReloads >= MAX_STALL_RELOADS) return next(at);
      stallReloads++;
      patch({ status: "loading" });
      load(sources[current], at);
    }, STALL_TIMEOUT_MS);
  };
  const onWaiting = () => {
    const st = playerState.get();
    if (st.status !== "playing") return;
    if (!st.buffering) patch({ buffering: true });
    armStallTimer();
  };
  // `stalled` solo cuenta para recargar en vivo; no muestra "cargando" (suele llegar con el video andando).
  const onStalled = armStallTimer;
  const onCanPlay = () => {
    if (playerState.get().buffering) patch({ buffering: false });
  };
  const onError = () => {
    // Con `<source>`, el error llega a la fuente; aquí solo los de `video.src`.
    if (video && video.getAttribute("src")) next(my());
  };
  const onEnded = () => {
    if (live) next(my());
    else if (onEndedCb) onEndedCb();
  };

  el.addEventListener("playing", onPlaying);
  el.addEventListener("pause", onPause);
  el.addEventListener("loadedmetadata", onMetadata);
  el.addEventListener("timeupdate", onTime);
  el.addEventListener("durationchange", onTime);
  el.addEventListener("waiting", onWaiting);
  el.addEventListener("stalled", onStalled);
  el.addEventListener("canplay", onCanPlay);
  el.addEventListener("error", onError);
  el.addEventListener("ended", onEnded);
  const tracks = el.audioTracks;
  if (tracks) {
    tracks.addEventListener("addtrack", syncTracks);
    tracks.addEventListener("removetrack", syncTracks);
    tracks.addEventListener("change", syncTracks);
  }
  const texts = el.textTracks;
  if (texts) {
    texts.addEventListener("addtrack", syncTracks);
    texts.addEventListener("removetrack", syncTracks);
  }
  return () => {
    el.removeEventListener("playing", onPlaying);
    el.removeEventListener("pause", onPause);
    el.removeEventListener("loadedmetadata", onMetadata);
    el.removeEventListener("timeupdate", onTime);
    el.removeEventListener("durationchange", onTime);
    el.removeEventListener("waiting", onWaiting);
    el.removeEventListener("stalled", onStalled);
    el.removeEventListener("canplay", onCanPlay);
    el.removeEventListener("error", onError);
    el.removeEventListener("ended", onEnded);
    if (tracks) {
      tracks.removeEventListener("addtrack", syncTracks);
      tracks.removeEventListener("removetrack", syncTracks);
      tracks.removeEventListener("change", syncTracks);
    }
    if (texts) {
      texts.removeEventListener("addtrack", syncTracks);
      texts.removeEventListener("removetrack", syncTracks);
    }
    stop();
    video = null;
  };
}
