import type { AudioTrackInfo } from "./player";

/** Códigos de 3 letras (ISO 639-2) → 2 letras, para comparar idiomas que vienen de fuentes distintas. */
const ISO3: Record<string, string> = {
  spa: "es",
  eng: "en",
  por: "pt",
  fre: "fr",
  fra: "fr",
  ger: "de",
  deu: "de",
  ita: "it",
  jpn: "ja",
  kor: "ko",
  chi: "zh",
  zho: "zh",
  rus: "ru",
  ara: "ar",
};

const LANGS: Record<string, string> = {
  es: "Español",
  en: "Inglés",
  pt: "Portugués",
  fr: "Francés",
  de: "Alemán",
  it: "Italiano",
  ja: "Japonés",
  ko: "Coreano",
  zh: "Chino",
  ru: "Ruso",
  ar: "Árabe",
};

/** Idioma normalizado: "spa", "es" y "es-419" dan "es". */
export function langKey(code: string): string {
  const c = (code || "").toLowerCase().split("-")[0];
  return ISO3[c] || c;
}

/** Nombre de una pista de audio o subtítulos para mostrar. */
export function trackLabel(t: AudioTrackInfo): string {
  const lang = LANGS[langKey(t.language)] || (t.language && t.language !== "und" ? t.language.toUpperCase() : "");
  if (t.label && lang && t.label.toLowerCase() !== t.language.toLowerCase()) return `${lang} · ${t.label}`;
  return lang || t.label || `Pista ${t.index + 1}`;
}
