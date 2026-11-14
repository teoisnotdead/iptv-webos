import { useEffect, useState } from "preact/hooks";

export type Async<T> = { value: T | undefined; error: boolean; loading: boolean };

/** Resultado de una promesa que depende de `deps` (se descarta si cambian antes de que llegue). */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): Async<T> & { reload: () => void } {
  const [state, setState] = useState<Async<T>>({ value: undefined, error: false, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ value: s.value, error: false, loading: true }));
    load().then(
      (value) => {
        if (alive) setState({ value, error: false, loading: false });
      },
      () => {
        if (alive) setState({ value: undefined, error: true, loading: false });
      },
    );
    return () => {
      alive = false;
    };
  }, [...deps, n]);
  return { ...state, reload: () => setN((x) => x + 1) };
}
