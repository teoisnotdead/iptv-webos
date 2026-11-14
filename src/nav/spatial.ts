/**
 * Navegación con las flechas del control remoto.
 *
 * - Enfocables: elementos con `data-nav` (siempre `<button>` o `<input>`, para que OK = click).
 * - Capas: `data-nav-layer`. Solo cuenta la última del documento (un diálogo abierto tapa la pantalla).
 * - Zonas: `data-nav-zone`. Al entrar a una zona desde afuera, el foco va a su `[data-nav-default]`
 *   o al último elemento que tuvo foco ahí, no al más cercano. Así volver a una lista cae en el ítem
 *   en que estabas.
 * - Los componentes que manejan sus flechas (listas virtuales, reproductor) llaman a
 *   `preventDefault()`: el manejador global de `window` corre después y respeta eso.
 */
import { isArrow, isTextInput, navKey } from "./keys";
import { handleBack } from "./back";

type Dir = "left" | "right" | "up" | "down";

const FOCUSABLE = "[data-nav]";

export function activeLayer(): HTMLElement {
  const layers = document.querySelectorAll<HTMLElement>("[data-nav-layer]");
  return layers.length ? layers[layers.length - 1] : document.body;
}

function isVisible(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function focusables(root: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  const all = root.querySelectorAll<HTMLElement>(FOCUSABLE);
  for (let i = 0; i < all.length; i++) if (isVisible(all[i])) out.push(all[i]);
  return out;
}

const zoneOf = (el: Element | null) => (el ? (el.closest("[data-nav-zone]") as HTMLElement | null) : null);

/** Último elemento con foco en cada zona. */
const memory = new WeakMap<HTMLElement, HTMLElement>();

function entryPoint(zone: HTMLElement): HTMLElement | null {
  const def = zone.querySelector<HTMLElement>("[data-nav-default]");
  if (def && isVisible(def)) return def;
  const last = memory.get(zone);
  if (last && zone.contains(last) && isVisible(last)) return last;
  return null;
}

/** Distancia por el lado que queda libre entre dos rangos (0 si se superponen). */
function gap(a1: number, a2: number, b1: number, b2: number): number {
  if (b2 < a1) return a1 - b2;
  if (b1 > a2) return b1 - a2;
  return 0;
}

const TOL = 2;

/** Puntaje de `b` como destino desde `a` en la dirección `dir` (menor es mejor; Infinity = no sirve). */
function score(dir: Dir, a: DOMRect, b: DOMRect): number {
  let primary: number;
  let ortho: number;
  let center: number;
  if (dir === "left" || dir === "right") {
    primary = dir === "right" ? b.left - a.right : a.left - b.right;
    ortho = gap(a.top, a.bottom, b.top, b.bottom);
    center = Math.abs(a.top + a.height / 2 - (b.top + b.height / 2));
  } else {
    primary = dir === "down" ? b.top - a.bottom : a.top - b.bottom;
    ortho = gap(a.left, a.right, b.left, b.right);
    center = Math.abs(a.left + a.width / 2 - (b.left + b.width / 2));
  }
  if (primary < -TOL) return Infinity;
  return Math.max(primary, 0) + ortho * 2 + center * 0.2;
}

export function focusEl(el: HTMLElement | null): boolean {
  if (!el) return false;
  el.focus();
  return document.activeElement === el;
}

/** Foco inicial de una capa: `[data-nav-autofocus]`, la entrada de su primera zona o el primer enfocable. */
export function focusInitial(layer: HTMLElement = activeLayer()): boolean {
  const auto = layer.querySelector<HTMLElement>("[data-nav-autofocus]");
  if (auto && isVisible(auto) && focusEl(auto)) return true;
  const zone = layer.querySelector<HTMLElement>("[data-nav-zone]");
  if (zone && focusEl(entryPoint(zone))) return true;
  return focusEl(focusables(layer)[0] || null);
}

/** Enfoca la entrada de una zona (por su nombre). */
export function focusZone(name: string): boolean {
  const zone = activeLayer().querySelector<HTMLElement>(`[data-nav-zone="${name}"]`);
  return zone ? enterZone(zone) : false;
}

/** Enfoca la entrada de una zona: su `[data-nav-default]`, lo último que tuvo foco ahí o lo primero. */
export function enterZone(zone: HTMLElement): boolean {
  return focusEl(entryPoint(zone) || focusables(zone)[0] || null);
}

export function move(dir: Dir): boolean {
  const layer = activeLayer();
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || cur === document.body || !layer.contains(cur) || !cur.matches(FOCUSABLE)) return focusInitial(layer);

  const from = cur.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of focusables(layer)) {
    if (el === cur) continue;
    const s = score(dir, from, el.getBoundingClientRect());
    if (s < bestScore) {
      bestScore = s;
      best = el;
    }
  }
  if (!best) return false;

  const toZone = zoneOf(best);
  if (toZone && !toZone.contains(cur)) {
    const entry = entryPoint(toZone);
    if (entry) best = entry;
  }
  return focusEl(best);
}

/** Instala los manejadores globales (una vez, al arrancar). */
export function installNavigation(): void {
  document.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement;
    const zone = zoneOf(el);
    if (zone) memory.set(zone, el);
  });

  // Puntero del Magic Remote (o el mouse en el PC): pasar por encima enfoca.
  document.addEventListener("mouseover", (e) => {
    const el = (e.target as HTMLElement).closest?.(FOCUSABLE) as HTMLElement | null;
    if (el && el !== document.activeElement && activeLayer().contains(el) && !isTextInput(document.activeElement)) el.focus();
  });

  window.addEventListener("keydown", (e) => {
    const k = navKey(e);
    if (k === "back") {
      if (e.defaultPrevented) return;
      e.preventDefault();
      handleBack();
      return;
    }
    if (e.defaultPrevented || !isArrow(k)) return;

    // En un campo de texto, izquierda/derecha mueven el cursor mientras no esté en un borde.
    const t = e.target;
    if (isTextInput(t) && (k === "left" || k === "right")) {
      const atStart = t.selectionStart === 0 && t.selectionEnd === 0;
      const atEnd = t.selectionStart === t.value.length;
      if ((k === "left" && !atStart) || (k === "right" && !atEnd)) return;
    }
    e.preventDefault();
    move(k);
  });
}
