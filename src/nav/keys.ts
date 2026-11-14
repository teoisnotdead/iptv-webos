/**
 * Teclas del control remoto de LG (y su equivalente en el teclado del PC para desarrollar).
 * Se usa `keyCode`: es lo que manda el control en webOS.
 */
export type NavKey =
  | "left"
  | "right"
  | "up"
  | "down"
  | "ok"
  | "back"
  | "play"
  | "pause"
  | "playpause"
  | "stop"
  | "ff"
  | "rw"
  | "chup"
  | "chdown"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "info"
  | "digit";

export function isTextInput(t: EventTarget | null): t is HTMLInputElement {
  return t instanceof HTMLInputElement && t.type !== "button" && t.type !== "checkbox";
}

export function navKey(e: KeyboardEvent): NavKey | null {
  const c = e.keyCode;
  if ((c >= 48 && c <= 57) || (c >= 96 && c <= 105)) return isTextInput(e.target) ? null : "digit";
  switch (c) {
    case 37:
      return "left";
    case 38:
      return "up";
    case 39:
      return "right";
    case 40:
      return "down";
    case 13:
      return "ok";
    case 461: // Atrás en el control LG
    case 27: // Escape (PC)
      return "back";
    case 8: // Retroceso (PC), salvo cuando se escribe
      return isTextInput(e.target) ? null : "back";
    case 415:
      return "play";
    case 19:
      return "pause";
    case 179:
      return "playpause";
    case 413:
      return "stop";
    case 417:
      return "ff";
    case 412:
      return "rw";
    case 33: // CH+ (RePág en el PC)
      return "chup";
    case 34: // CH− (AvPág)
      return "chdown";
    case 403:
      return "red";
    case 404:
      return "green";
    case 405:
      return "yellow";
    case 406:
      return "blue";
    case 457:
      return "info";
  }
  return null;
}

export function digitOf(e: KeyboardEvent): number {
  return e.keyCode >= 96 ? e.keyCode - 96 : e.keyCode - 48;
}

export const isArrow = (k: NavKey | null): k is "left" | "right" | "up" | "down" =>
  k === "left" || k === "right" || k === "up" || k === "down";
