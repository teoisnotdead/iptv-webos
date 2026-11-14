import { useEffect, useState } from "preact/hooks";

/** Estado observable mínimo (sin dependencias) para lo que comparten varias pantallas. */
export type Store<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (fn: (v: T) => void) => () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(next) {
      const v = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      if (v === value) return;
      value = v;
      subs.forEach((fn) => fn(v));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  const [v, setV] = useState(store.get);
  useEffect(() => {
    setV(store.get());
    return store.subscribe((next) => {
      setV(() => next);
    });
  }, [store]);
  return v;
}
