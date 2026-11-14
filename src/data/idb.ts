/**
 * Almacén clave → texto en IndexedDB para la copia del catálogo (localStorage no alcanza: ~5 MB).
 * Si IndexedDB no está o falla, todo responde vacío y la app sigue solo con memoria.
 */
const DB = "iptv";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let done = false;
      const finish = (db: IDBDatabase | null) => {
        if (!done) {
          done = true;
          resolve(db);
        }
      };
      // Si el TV no contesta, no bloquear el arranque.
      setTimeout(() => finish(null), 3000);
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => finish(req.result);
        req.onerror = () => finish(null);
      } catch {
        finish(null);
      }
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest | void): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(STORE, mode);
          const req = op(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req ? (req.result as T) : null);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export const idbGet = (key: string) => run<string>("readonly", (s) => s.get(key));

export const idbSet = (key: string, value: string) => run<void>("readwrite", (s) => s.put(value, key));

/** Borra todas las claves que empiezan con `prefix` (la copia de una cuenta). */
export function idbDeletePrefix(prefix: string): Promise<void> {
  return run<void>("readwrite", (s) => {
    s.delete(IDBKeyRange.bound(prefix, prefix + "￿"));
  }).then(() => undefined);
}
