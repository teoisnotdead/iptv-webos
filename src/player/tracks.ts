import type { AudioTrackInfo } from "./player";

const LANGS: Record<string, string> = {
  es: "Español",
  spa: "Español",
  en: "Inglés",
  eng: "Inglés",
  pt: "Portugués",
  por: "Portugués",
  fr: "Francés",
  fre: "Francés",
  fra: "Francés",
  de: "Alemán",
  ger: "Alemán",
  deu: "Alemán",
  it: "Italiano",
  ita: "Italiano",
  ja: "Japonés",
  jpn: "Japonés",
  ko: "Coreano",
  kor: "Coreano",
  zh: "Chino",
  chi: "Chino",
  zho: "Chino",
  ru: "Ruso",
  rus: "Ruso",
  ar: "Árabe",
  ara: "Árabe",
};

/** Nombre de una pista de audio para mostrar. */
export function trackLabel(t: AudioTrackInfo): string {
  const lang = LANGS[t.language.toLowerCase().split("-")[0]] || (t.language && t.language !== "und" ? t.language.toUpperCase() : "");
  if (t.label && lang && t.label.toLowerCase() !== t.language.toLowerCase()) return `${lang} · ${t.label}`;
  return lang || t.label || `Pista ${t.index + 1}`;
}
