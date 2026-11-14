/**
 * Cuentas guardadas en el TV (localStorage de la app) y sesión activa.
 * Las credenciales quedan en el almacenamiento propio de la app, que el TV no comparte con otras.
 */
import { PANEL_LOCKED, PANEL_URL } from "../config";
import { formatDate } from "../lib/format";
import { createStore } from "../lib/store";
import { toAccount, type AccountInfo } from "./models";
import { readJson, writeJson } from "./storage";
import { accountKey, api, normalizePanelUrl, PanelError, type Creds } from "./xtream";

const KEY = "iptv:cuentas";

type Saved = { accounts: Creds[]; active: number };

function loadSaved(): Saved {
  const s = readJson<Saved>(KEY, { accounts: [], active: -1 });
  const accounts = Array.isArray(s.accounts) ? s.accounts.filter((a) => a && a.url && a.username) : [];
  return { accounts, active: typeof s.active === "number" ? s.active : -1 };
}

function activeOf(s: Saved): Creds | null {
  const c = s.accounts[s.active];
  if (!c) return null;
  // Versión de revendedor: si cambió el servidor fijo, las cuentas de otro servidor no sirven.
  if (PANEL_LOCKED && c.url.toLowerCase() !== PANEL_URL.toLowerCase()) return null;
  return c;
}

let saved = loadSaved();

/** Cuenta en uso, o null si hay que iniciar sesión. */
export const session = createStore<Creds | null>(activeOf(saved));

/** Aviso para mostrar en el login después de cerrar la sesión por un motivo (cuenta vencida…). */
export const loginNotice = createStore<string | null>(null);

function persist(next: Saved) {
  saved = next;
  writeJson(KEY, next);
  session.set(activeOf(next));
}

export type LoginErrorCode = "bad_request" | "bad_url" | "invalid" | "expired" | "disabled" | "inactive" | "unreachable";

export class LoginError extends Error {
  code: LoginErrorCode;
  constructor(code: LoginErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "LoginError";
  }
}

/** Problema definitivo de una cuenta según el panel, o null si está activa. */
function accountProblem(info: AccountInfo): LoginError | null {
  if (info.auth !== 1) return new LoginError("invalid", "Usuario o contraseña incorrectos");
  if (info.status && info.status !== "Active") {
    if (info.status === "Expired") {
      const when = info.expDate ? ` (venció el ${formatDate(info.expDate)})` : "";
      return new LoginError("expired", `Tu suscripción está vencida${when}`);
    }
    if (info.status === "Banned" || info.status === "Disabled") return new LoginError("disabled", "Tu cuenta está deshabilitada");
    return new LoginError("inactive", `Cuenta no activa (${info.status})`);
  }
  return null;
}

async function fetchAccount(c: Creds): Promise<AccountInfo> {
  try {
    return toAccount(await api(c));
  } catch (e) {
    if (e instanceof PanelError && e.code === "invalid") return toAccount(null); // respondió, pero no es la API
    throw new LoginError("unreachable", "No se pudo contactar al servidor. Revisa la dirección y tu conexión.");
  }
}

/** Valida la cuenta contra el panel y la deja como activa. Lanza `LoginError`. */
export async function login(input: { url: string; username: string; password: string }): Promise<void> {
  const url = PANEL_LOCKED ? PANEL_URL : normalizePanelUrl(input.url);
  const username = input.username.trim();
  const password = input.password.trim();
  if (!url) throw new LoginError("bad_url", "Ingresa la dirección del servidor");
  if (!username || !password) throw new LoginError("bad_request", "Ingresa usuario y contraseña");

  const creds: Creds = { url, username, password };
  const problem = accountProblem(await fetchAccount(creds));
  if (problem) throw problem;

  const accounts = saved.accounts.filter((a) => accountKey(a) !== accountKey(creds));
  accounts.unshift(creds);
  loginNotice.set(null);
  persist({ accounts, active: 0 });
}

/** Cierra la sesión y olvida la cuenta en uso. */
export function logout(notice: string | null = null): void {
  const current = session.get();
  const accounts = current ? saved.accounts.filter((a) => accountKey(a) !== accountKey(current)) : saved.accounts;
  loginNotice.set(notice);
  persist({ accounts, active: -1 });
}

/**
 * Revisa al abrir la app que la cuenta siga activa. Un estado definitivo (vencida, deshabilitada)
 * cierra la sesión; una respuesta dudosa (`auth != 1`) se reintenta una vez para que un panel
 * inestable no saque a nadie. Sin conexión, la sesión sigue.
 */
export async function verifySession(): Promise<AccountInfo | null> {
  const c = session.get();
  if (!c) return null;
  try {
    let info = await fetchAccount(c);
    if (info.auth !== 1) {
      await new Promise((r) => setTimeout(r, 800));
      info = await fetchAccount(c);
    }
    const problem = accountProblem(info);
    if (problem && session.get() === c) {
      logout(problem.code === "invalid" ? "La sesión ya no es válida. Vuelve a ingresar." : problem.message);
      return null;
    }
    return info;
  } catch {
    return null;
  }
}

/** Estado de la cuenta en uso, para la pantalla Cuenta (no se cachea). */
export function accountInfo(): Promise<AccountInfo> {
  const c = session.get();
  if (!c) return Promise.reject(new PanelError("Sesión vencida", "session"));
  return fetchAccount(c);
}
