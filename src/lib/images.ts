/**
 * Muchos paneles toman las imágenes de TMDB en tamaño original (a veces de 2000 px). El TV las
 * decodifica todas en memoria: se piden en el tamaño que de verdad se dibuja.
 */
const TMDB = /^(https?:\/\/image\.tmdb\.org\/t\/p\/)[^/]+\//i;

export type ImageSize = "w185" | "w342" | "w780" | "w1280";

export function sized(url: string | undefined, size: ImageSize): string {
  if (!url) return "";
  return url.replace(TMDB, `$1${size}/`);
}
