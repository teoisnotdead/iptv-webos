import { useEffect, useState } from "preact/hooks";

/** Píxeles por rem (el tamaño raíz depende del ancho de la pantalla). Sin ResizeObserver: escucha `resize`. */
export function remPx(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

export function useRem(): number {
  const [rem, setRem] = useState(remPx);
  useEffect(() => {
    const on = () => setRem(remPx());
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
    };
  }, []);
  return rem;
}
