/** Agrupaciones genéricas de listas del catálogo. */

export function groupByCategory<T>(items: T[], getCategoryId: (x: T) => string | number | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const key = String(getCategoryId(it) ?? "");
    const bucket = map.get(key);
    if (bucket) bucket.push(it);
    else map.set(key, [it]);
  }
  return map;
}

/**
 * Los `n` de mayor `score`, sin ordenar toda la lista (con miles de títulos, ordenarla entera cuesta
 * en el TV y se hace cada vez que se arma una pantalla). A igual puntaje va primero el que aparece
 * después en la lista. `score` devuelve NaN para dejar fuera un elemento.
 */
function topBy<T>(items: T[], n: number, score: (x: T) => number): T[] {
  const top: T[] = [];
  const scores: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const s = score(items[i]);
    if (s !== s) continue;
    if (top.length === n && s < scores[n - 1]) continue;
    // Primer lugar con puntaje <= s (el nuevo gana los empates porque viene después).
    let lo = 0;
    let hi = top.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (scores[mid] > s) lo = mid + 1;
      else hi = mid;
    }
    top.splice(lo, 0, items[i]);
    scores.splice(lo, 0, s);
    if (top.length > n) {
      top.pop();
      scores.pop();
    }
  }
  return top;
}

/** Los `n` más nuevos según `added` (si el panel no lo manda, los últimos de la lista, que suelen ser los más nuevos). */
export function newest<T extends { added: number }>(items: T[], n: number): T[] {
  return topBy(items, n, (x) => x.added || 0);
}

/** Los `n` mejor puntuados (rating del panel, de 0 a 10), solo entre los que tienen imagen. */
export function topRated<T extends { rating: string; img: string }>(items: T[], n: number): T[] {
  return topBy(items, n, (x) => {
    const r = Number(x.rating);
    return x.img && r > 0 ? r : NaN;
  });
}

/** Índice → elemento, por id. */
export function byId<T extends { id: number }>(items: T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const x of items) m.set(x.id, x);
  return m;
}
