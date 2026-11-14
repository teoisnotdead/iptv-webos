/**
 * Cliente de la API compatible con Xtream Codes (`player_api.php`). La app habla directo con el panel:
 * el panel responde CORS con el mismo `Origin` que recibe (incluido `null`, que es el de una app `file://`).
 *
 * Las URLs llevan usuario y contraseña: nunca se registran ni se muestran. Los mensajes de
 * `PanelError` son aptos para mostrar.
 */

/** Una cuenta: servidor (URL base del panel, sin barra final) + usuario + contraseña. */
export type Creds = { url: string; username: string; password: string; name?: string };

export type PanelErrorCode = "unreachable" | "timeout" | "http" | "invalid" | "session";

export class PanelError extends Error {
  code: PanelErrorCode;
  constructor(message: string, code: PanelErrorCode) {
    super(message);
    this.code = code;
    this.name = "PanelError";
  }
}

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Deja la dirección que escribió el usuario como URL base del panel: agrega `http://` si falta y quita
 * la barra final o un `/player_api.php…`, `/get.php…` o `/xmltv.php…` pegado desde un enlace. "" si queda vacía.
 */
export function normalizePanelUrl(input: string): string {
  let s = input.trim();
  if (!s) return "";
  const scheme = SCHEME.exec(s);
  s = scheme ? scheme[0].toLowerCase() + s.slice(scheme[0].length) : "http://" + s;
  s = s.split("#")[0].split("?")[0];
  for (const tail of ["/player_api.php", "/get.php", "/xmltv.php"]) {
    if (s.toLowerCase().endsWith(tail)) s = s.slice(0, -tail.length);
  }
  return s.replace(/\/+$/, "");
}

/** Nombre del servidor para mostrar, sin esquema ni puerto. */
export function hostOf(url: string): string {
  return url.replace(SCHEME, "").split("/")[0].split(":")[0];
}

export const accountKey = (c: Creds) => `${c.url.toLowerCase()}|${c.username}`;

const enc = encodeURIComponent;

function apiUrl(c: Creds, params: Record<string, string | number>): string {
  let url = `${c.url}/player_api.php?username=${enc(c.username)}&password=${enc(c.password)}`;
  for (const k in params) url += `&${k}=${enc(String(params[k]))}`;
  return url;
}

/**
 * GET de JSON con XHR: Chromium 53 no tiene AbortController, y XHR trae timeout y abort().
 * `invalid` = respondió algo que no es JSON (algunos paneles mandan HTML o vacío).
 */
function getJson(url: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new PanelError(`El servidor respondió ${xhr.status}`, "http"));
        return;
      }
      const text = xhr.responseText;
      try {
        resolve(text ? JSON.parse(text) : null);
      } catch {
        reject(new PanelError("Respuesta inválida del servidor", "invalid"));
      }
    };
    xhr.onerror = () => reject(new PanelError("No se pudo contactar al servidor", "unreachable"));
    xhr.ontimeout = () => reject(new PanelError("El servidor tardó demasiado en responder", "timeout"));
    xhr.send();
  });
}

/** Las listas grandes (miles de películas) pueden tardar en llegar a un TV. */
const LIST_TIMEOUT = 90_000;
const INFO_TIMEOUT = 20_000;

export function api(c: Creds, action?: string, params: Record<string, string | number> = {}, timeoutMs = INFO_TIMEOUT): Promise<unknown> {
  if (!SCHEME.test(c.url)) return Promise.reject(new PanelError("La dirección del servidor no es válida", "invalid"));
  return getJson(apiUrl(c, action ? { action, ...params } : params), timeoutMs);
}

/** Listas del catálogo. Si no hay datos, algunos paneles mandan `{}`, null o HTML en vez de `[]`. */
export async function apiList(c: Creds, action: string): Promise<unknown[]> {
  try {
    const d = await api(c, action, {}, LIST_TIMEOUT);
    return Array.isArray(d) ? d : [];
  } catch (e) {
    if (e instanceof PanelError && e.code === "invalid") return [];
    throw e;
  }
}

export type StreamKind = "live" | "movie" | "series";

/** URL directa del stream. Lleva las credenciales: no registrarla ni mostrarla. */
export function streamUrl(c: Creds, kind: StreamKind, id: string | number, ext: string): string {
  return `${c.url}/${kind}/${enc(c.username)}/${enc(c.password)}/${id}.${ext}`;
}

/* ---------- Lectura tolerante ----------
 * Los paneles son inconsistentes: un mismo campo llega como número o texto, puede faltar, venir en
 * null o como arreglo. Texto vacío o 0 significan "no viene".
 */

export function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && isFinite(v)) return String(v);
  return "";
}

export function int(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? Math.trunc(v) : 0;
  if (typeof v === "string") {
    const n = parseInt(v.trim(), 10);
    return isFinite(n) ? n : 0;
  }
  return 0;
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
