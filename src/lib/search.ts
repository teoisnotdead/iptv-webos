/**
 * Búsqueda por nombre en las listas del catálogo, pensada para el TV (miles de títulos):
 * - Sin tildes ni mayúsculas, y los signos cuentan como espacio: "spider man" encuentra "Spider-Man",
 *   "pelicula" encuentra "Película".
 * - Tienen que aparecer todas las palabras, en cualquier orden.
 * - Orden: cada palabra buscada suma según cómo aparece (palabra entera 0, comienzo de palabra 1,
 *   dentro de otra 2), y se gana medio punto si el nombre empieza con lo buscado. "pelicula 12" pone
 *   "Película 12" antes que "Película 120", y esta antes que "Película 32 (2012)". A igual puntaje,
 *   el nombre más corto (el más parecido).
 * Los nombres ya normalizados se guardan por lista: se calculan una vez, no en cada tecla.
 */

/** Signos que separan palabras. No se usa `\p{L}` (no existe en Chromium 53): el resto de las letras se conserva. */
const SEPARATORS = /[\s\-_.,:;|/\\()[\]{}'"`´!¡?¿+*&#@~^<>=%$·•–—]+/g;
const MARKS = /[̀-ͯ]/g;

export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(MARKS, "").replace(SEPARATORS, " ").trim();
}

const cache = new WeakMap<object, string[]>();

/** Nombres normalizados con un espacio adelante: así "empieza con" y "palabra que empieza con" son un `indexOf`. */
function foldedNames(items: Array<{ name: string }>): string[] {
  let names = cache.get(items);
  if (!names) {
    names = items.map((x) => " " + fold(x.name));
    cache.set(items, names);
  }
  return names;
}

/** `best`: puntaje del mejor resultado (menor es mejor; Infinity si no hay), para ordenar grupos entre sí. */
export type SearchResult<T> = { total: number; items: T[]; best: number };

export function searchByName<T extends { name: string }>(items: T[], query: string, limit = Infinity): SearchResult<T> {
  const q = fold(query);
  if (!q) return { total: 0, items: [], best: Infinity };
  const words = q.split(" ");
  const names = foldedNames(items);
  const hits: Array<{ i: number; s: number }> = [];
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    let s = 0;
    for (let w = 0; w < words.length && s >= 0; w++) {
      const word = words[w];
      if (n.indexOf(word) < 0) s = -1;
      else if (n.indexOf(" " + word + " ") >= 0 || n.slice(-word.length - 1) === " " + word) s += 0;
      else if (n.indexOf(" " + word) >= 0) s += 1;
      else s += 2;
    }
    if (s < 0) continue;
    hits.push({ i, s: n.indexOf(" " + q) === 0 ? s : s + 0.5 });
  }
  // El índice desempata: el `sort` de Chromium 53 no es estable.
  hits.sort((a, b) => a.s - b.s || names[a.i].length - names[b.i].length || a.i - b.i);
  const n = Math.min(hits.length, limit);
  const out: T[] = [];
  for (let k = 0; k < n; k++) out.push(items[hits[k].i]);
  return { total: hits.length, items: out, best: hits.length ? hits[0].s : Infinity };
}

/** Mínimo de letras para buscar en todo el catálogo (con una sola, casi todo coincide). */
export const MIN_QUERY = 2;
