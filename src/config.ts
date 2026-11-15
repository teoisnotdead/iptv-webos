/**
 * Datos de esta instalación (panel y marca). Vienen de `.env.local` al compilar (ver `.env.example`):
 * cada revendedor tiene su propio build.
 */
import { normalizePanelUrl } from "./data/xtream";

const env = import.meta.env;

/** Servidor que aparece por defecto en el login. */
export const PANEL_URL = normalizePanelUrl(env.VITE_PANEL_URL || "");

/** Versión de revendedor: el servidor queda fijo y no se muestra. */
export const PANEL_LOCKED = env.VITE_PANEL_LOCK === "true" && PANEL_URL !== "";

/** "Lytra TV" por defecto: se escribe con la firma de Lytra (ver `ui/Brand.tsx`). */
export const BRAND_NAME = (env.VITE_BRAND_NAME || "").trim() || "Lytra TV";

const color = (env.VITE_BRAND_COLOR || "").trim();
export const BRAND_COLOR = /^#[0-9a-f]{6}$/i.test(color) ? color : "#a78bfa";
