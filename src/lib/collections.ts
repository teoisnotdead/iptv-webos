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

/** Los `n` más nuevos según `added` (si el panel no lo manda, los últimos de la lista, que suelen ser los más nuevos). */
export function newest<T extends { added: number }>(items: T[], n: number): T[] {
  const idx = items.map((_x, i) => i);
  idx.sort((a, b) => items[b].added - items[a].added || b - a);
  return idx.slice(0, n).map((i) => items[i]);
}

/** Los `n` mejor puntuados (rating del panel, de 0 a 10), solo entre los que tienen imagen. */
export function topRated<T extends { rating: string; img: string }>(items: T[], n: number): T[] {
  return items
    .filter((x) => x.img && Number(x.rating) > 0)
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, n);
}

/** Índice → elemento, por id. */
export function byId<T extends { id: number }>(items: T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const x of items) m.set(x.id, x);
  return m;
}
