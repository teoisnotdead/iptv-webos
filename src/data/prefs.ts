/** Preferencias de reproducción (solo en este TV). */
import { readJson, writeJson } from "./storage";

export type LiveEngine = "hls" | "ts";

const ENGINE_KEY = "iptv:motor-en-vivo";
const AUDIO_KEY = "iptv:audio";

/** TV en vivo: arrancar en HLS (por defecto) o directo en MPEG-TS. */
export function liveEngine(): LiveEngine {
  return readJson<string>(ENGINE_KEY, "hls") === "ts" ? "ts" : "hls";
}

export function setLiveEngine(e: LiveEngine): void {
  writeJson(ENGINE_KEY, e);
}

/** Idioma de audio que eligió el usuario la última vez ("" = nunca eligió). */
export function audioLanguage(): string {
  return readJson<string>(AUDIO_KEY, "");
}

export function setAudioLanguage(lang: string): void {
  writeJson(AUDIO_KEY, lang);
}

const SUBS_KEY = "iptv:subtitulos";

/** Subtítulos que eligió la última vez: idioma, "off" (desactivados) o "" (nunca eligió). */
export function subtitleLanguage(): string {
  return readJson<string>(SUBS_KEY, "");
}

export function setSubtitleLanguage(lang: string): void {
  writeJson(SUBS_KEY, lang);
}
