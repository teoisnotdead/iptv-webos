/** Utilidades puras de formato de texto, fechas y colores de placeholder. */

/** El panel entrega títulos y descripciones del EPG en base64. */
export function b64(s?: string): string {
  if (!s) return "";
  try {
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return s;
  }
}

/** Títulos de relleno que mandan algunos paneles cuando en realidad no tienen guía. */
const EPG_PLACEHOLDER = /^(sin informaci[oó]n|no information|n\/a|-*)$/i;

/** Título de un programa de la guía, o "" si falta o es de relleno ("Sin información"). */
export function epgTitle(e?: { title?: string }): string {
  const title = b64(e?.title).trim();
  return EPG_PLACEHOLDER.test(title) ? "" : title;
}

const LOCALE = "es-CL";

/*
 * Formateadores creados una vez: `toLocaleString()` y compañía crean uno nuevo en cada llamada, y en
 * el TV eso se nota cuando se formatean cientos de números al armar una pantalla.
 */
const NUMBER = new Intl.NumberFormat(LOCALE);
const TIME = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });
const DATE = new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });

/** Número con separador de miles (4.077). */
export function formatCount(n: number): string {
  return NUMBER.format(n);
}

export function hhmm(ts?: string | number): string {
  if (!ts) return "";
  return TIME.format(new Date(Number(ts) * 1000));
}

export function formatDate(ts?: string | number | null): string {
  if (!ts) return "";
  return DATE.format(new Date(Number(ts) * 1000));
}

/** Días que faltan para el vencimiento (negativo si ya venció). */
export function daysLeft(ts?: string | number | null): number | null {
  if (!ts) return null;
  return Math.ceil((Number(ts) * 1000 - Date.now()) / 86_400_000);
}

/** Minúsculas y sin tildes, para búsquedas. */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Rating válido como texto con un decimal, o null si falta o es 0. */
export function formatRating(r?: string | number | null): string | null {
  const n = Number(r);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : null;
}

/** "01:52:00" | "112" (min) | "1h 52m" → "1 h 52 min". Si no se entiende, lo deja igual. */
export function formatDuration(d?: string | number | null): string | undefined {
  if (d == null || d === "") return undefined;
  const s = String(d).trim();
  const clock = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  let minutes: number | null = null;
  if (clock) minutes = Number(clock[1]) * 60 + Number(clock[2]);
  else if (/^\d+$/.test(s)) minutes = Number(s);
  if (minutes == null) return s;
  if (minutes <= 0) return undefined;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`;
}

const QUALITY_TAG = /^(F?HD|SD|4K|UHD|HQ|E|P|LT|ENC|MULTI[- ]?AUDIO|\d+\s?mb|\d+\s?hrs?)$/i;

/** Iniciales de un canal a partir del nombre "limpio" (sin país ni calidad). */
export function initials(name: string): string {
  const segments = name
    .split("|")
    .map((s) => s.replace(/[.()*]/g, "").trim())
    .filter((s) => s.length > 1 && !QUALITY_TAG.test(s));
  const useful = segments.length > 1 && /^[A-Z]{2,3}$/.test(segments[0]) ? segments.slice(1) : segments;
  const words = (useful[0] || name).split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || "?").slice(0, 2).toUpperCase();
}

const HUES = [285, 300, 262, 318, 248, 276, 305, 292];

/** Tono estable por título, para que un mismo póster sin imagen tenga siempre el mismo color. */
export function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length];
}

/** Fondo degradado violeta/rosado usado cuando un póster no trae imagen (hsl: Chromium 53 no tiene oklch). */
export function placeholderBackground(name: string): string {
  const h = hueOf(name);
  return `linear-gradient(160deg, hsl(${h}, 42%, 40%) 0%, hsl(${h + 18}, 32%, 21%) 52%, var(--card) 100%)`;
}

/** Primer elemento útil de un campo que el panel entrega como texto o arreglo. */
export function firstOf(v?: string | string[] | null): string | undefined {
  const x = Array.isArray(v) ? v.find(Boolean) : v;
  return x || undefined;
}

export function splitList(s?: string): string[] {
  return (s || "")
    .split(/[,/]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Segundos → "1:02:03" o "12:34". */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(isFinite(sec) ? sec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** "Quedan 45 min" a partir de posición y duración en segundos. */
export function timeLeft(pos: number, dur: number): string {
  const min = Math.max(1, Math.round((dur - pos) / 60));
  if (min < 60) return `Quedan ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `Quedan ${h} h ${m} min` : `Quedan ${h} h`;
}
