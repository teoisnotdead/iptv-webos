/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PANEL_URL?: string;
  readonly VITE_PANEL_LOCK?: string;
  readonly VITE_BRAND_NAME?: string;
  readonly VITE_BRAND_COLOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** API de la plataforma webOS (solo existe en el TV). */
interface Window {
  webOS?: { platformBack?: () => void };
  PalmSystem?: { platformBack?: () => void };
  /** Llamadas a servicios luna:// del TV (p. ej. `com.webos.media`). */
  PalmServiceBridge?: new () => PalmServiceBridge;
}

interface PalmServiceBridge {
  onservicecallback: ((msg: string) => void) | null;
  call(uri: string, params: string): void;
  cancel(): void;
}

/** Pistas de audio del `<video>`: el TV las tiene (webOS ≥ 3.0); Chrome de escritorio no. */
interface MediaAudioTrack {
  id: string;
  kind: string;
  label: string;
  language: string;
  enabled: boolean;
}

interface MediaAudioTrackList extends EventTarget {
  readonly length: number;
  [index: number]: MediaAudioTrack;
}

interface HTMLMediaElement {
  readonly audioTracks?: MediaAudioTrackList;
  /** webOS: id del reproductor interno ("<invalid mediaId>" mientras no hay uno). Cambia en cada carga. */
  readonly mediaId?: string;
  /** Chrome: bytes de audio decodificados (0 = no se pudo decodificar la pista). */
  readonly webkitAudioDecodedByteCount?: number;
}
