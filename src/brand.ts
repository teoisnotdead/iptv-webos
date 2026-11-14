import { BRAND_COLOR, BRAND_NAME } from "./config";

/**
 * Pone el color de marca en `<html>` como variables CSS. Chromium 53 no tiene `color-mix`, así que
 * las variantes se calculan aquí: `--primary-hover`/`--primary-soft` (más claro) y `--primary-aNN`
 * (NN % de opacidad). En el CSS de los componentes se usan siempre estos tokens, nunca el hex.
 */
const ALPHAS = [8, 12, 16, 20, 25, 33, 40, 50, 67, 80];

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa (WCAG) de 0 a 1. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function applyBrand(): void {
  const c = rgb(BRAND_COLOR);
  const [r, g, b] = c;
  const light = (t: number) => c.map((v) => Math.round(v * t + 255 * (1 - t))).join(", ");
  const vars: Record<string, string> = {
    "--primary": BRAND_COLOR,
    "--primary-foreground": luminance(c) > 0.3 ? "#120e1f" : "#ffffff",
    "--primary-hover": `rgb(${light(0.7)})`,
    "--primary-soft": `rgb(${light(0.7)})`,
  };
  for (const a of ALPHAS) vars[`--primary-a${String(a).padStart(2, "0")}`] = `rgba(${r}, ${g}, ${b}, ${a / 100})`;

  const root = document.documentElement;
  for (const k in vars) root.style.setProperty(k, vars[k]);
  document.title = BRAND_NAME;
}
