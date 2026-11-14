/**
 * Reproductor interno del TV LG (`luna://com.webos.media`). El Chromium del TV no pone los subtítulos
 * incrustados del archivo (MP4/MKV) en `video.textTracks`, pero el reproductor del TV sí los tiene:
 * la lista llega en el mensaje `sourceInfo` y se activan con `selectTrack` + `setSubtitleEnable`.
 * Probado en el TV del dueño (webOS 4.5) el 2026-11-14. La API no está documentada por LG.
 *
 * `sourceInfo` se manda una sola vez, cuando el TV termina de abrir el archivo (antes de
 * `loadedmetadata`): hay que suscribirse apenas el `<video>` tiene un `mediaId` válido, unos 40 ms
 * después de `loadstart`. Antes de eso `mediaId` vale "<invalid mediaId>".
 */

const URI = "luna://com.webos.media/";
/** Cada cuánto se mira si ya hay `mediaId`, y hasta cuándo. */
const POLL_MS = 25;
const POLL_MAX_MS = 15_000;

export type LunaText = { index: number; language: string };

export function hasLuna(): boolean {
  return typeof window.PalmServiceBridge === "function";
}

const validId = (id: string | undefined): id is string => !!id && id.charAt(0) !== "<";

/** El TV manda "(null)" o vacío cuando la pista no trae idioma. */
const cleanLang = (l: unknown): string => (typeof l === "string" && l !== "(null)" && l !== "und" ? l : "");

/** Llamadas sueltas: se guarda la referencia hasta la respuesta para que no se pierda la llamada. */
const inFlight: PalmServiceBridge[] = [];

function call(method: string, params: Record<string, unknown>): void {
  const b = new window.PalmServiceBridge!();
  inFlight.push(b);
  b.onservicecallback = () => {
    const i = inFlight.indexOf(b);
    if (i >= 0) inFlight.splice(i, 1);
  };
  b.call(URI + method, JSON.stringify(params));
}

/**
 * Espera el `mediaId` del video que se acaba de cargar (distinto de `stale`, el del video anterior),
 * se suscribe a sus eventos y entrega los subtítulos de `sourceInfo`. Después cancela la suscripción
 * (manda mensajes varias veces por segundo). Devuelve la función para cancelar antes.
 */
export function watchSourceInfo(video: HTMLVideoElement, stale: string, onInfo: (mediaId: string, texts: LunaText[]) => void): () => void {
  let bridge: PalmServiceBridge | null = null;
  const until = Date.now() + POLL_MAX_MS;

  const cancel = () => {
    clearInterval(poll);
    if (!bridge) return;
    bridge.onservicecallback = null;
    try {
      bridge.cancel();
    } catch {
      // Ya estaba cerrada.
    }
    bridge = null;
  };

  const poll = window.setInterval(() => {
    const id = video.mediaId;
    if (!validId(id) || id === stale) {
      if (Date.now() > until) cancel();
      return;
    }
    clearInterval(poll);
    const b = new window.PalmServiceBridge!();
    bridge = b;
    b.onservicecallback = (msg) => {
      if (msg.indexOf('"sourceInfo"') < 0) return;
      let info: SourceInfo | undefined;
      try {
        info = (JSON.parse(msg) as { sourceInfo?: SourceInfo }).sourceInfo;
      } catch {
        return;
      }
      if (!info) return;
      const prog = info.programInfo && info.programInfo[0];
      const list = (prog && prog.subtitleTrackInfo) || [];
      cancel();
      onInfo(
        id,
        list.map((t, i) => ({ index: i, language: cleanLang(t.language) })),
      );
    };
    b.call(URI + "subscribe", JSON.stringify({ mediaId: id, subscribe: true }));
  }, POLL_MS);

  return cancel;
}

/** Muestra la pista de subtítulos `index` del reproductor del TV, o los apaga con -1. */
export function lunaShowText(mediaId: string, index: number): void {
  if (index >= 0) call("selectTrack", { mediaId, type: "text", index });
  call("setSubtitleEnable", { mediaId, enable: index >= 0 });
}

type SourceInfo = {
  programInfo?: { subtitleTrackInfo?: { language?: string; type?: string }[] }[];
};
