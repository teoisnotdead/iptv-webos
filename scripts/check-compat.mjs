/**
 * Revisa que el build funcione en el navegador del TV (webOS 4.x = Chromium 53):
 * - CSS: nada de lo que Chromium 53 no entiende (Grid, gap, sticky, aspect-ratio, color-mix…).
 * - JS: sintaxis ES2016 como máximo (es-check). Lo de la biblioteca estándar lo cubre src/polyfills.ts.
 * - HTML: un script clásico, sin `type="module"` ni `crossorigin`.
 * Falla el build si encuentra algo.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const problems = [];

const CSS_RULES = [
  [/display\s*:\s*(inline-)?grid/, "CSS Grid"],
  [/grid-template|grid-area|grid-column|grid-row/, "CSS Grid"],
  [/(^|[;{\s])(row-|column-)?gap\s*:/, "gap (en flex no existe en Chromium 53)"],
  [/position\s*:\s*sticky/, "position: sticky"],
  [/aspect-ratio/, "aspect-ratio"],
  [/color-mix\(/, "color-mix()"],
  [/oklch\(|oklab\(|lab\(|lch\(/, "colores oklch/lab"],
  [/(^|[;{\s])inset\s*:/, "inset"],
  [/:focus-visible|:focus-within|:is\(|:where\(|:has\(/, "selector moderno (:focus-visible, :focus-within, :is, :where, :has)"],
  [/(^|[^-\w])(min|max|clamp)\(/, "min()/max()/clamp()"],
  [/backdrop-filter/, "backdrop-filter"],
  [/@container|@layer|container-type/, "@container/@layer"],
  [/\benv\(/, "env()"],
];

const assets = join(DIST, "assets");
for (const f of readdirSync(assets)) {
  if (!f.endsWith(".css")) continue;
  const css = readFileSync(join(assets, f), "utf8");
  for (const [re, what] of CSS_RULES) {
    const m = re.exec(css);
    if (m) problems.push(`${f}: ${what} → …${css.slice(Math.max(0, m.index - 40), m.index + 40)}…`);
  }
}

const html = readFileSync(join(DIST, "index.html"), "utf8");
if (/type="module"|crossorigin/.test(html)) problems.push('index.html: queda `type="module"` o `crossorigin` (no carga en Chromium 53 bajo file://)');
if (!/<script defer src="\.\/assets\/app\.js">/.test(html)) problems.push("index.html: no encuentro <script defer src=\"./assets/app.js\">");

// Con barras normales: es-check los toma como patrones glob.
const js = readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => `${DIST}/assets/${f}`);
if (js.length !== 1) problems.push(`se esperaba un solo .js en dist/assets y hay ${js.length}`);
try {
  execFileSync(process.execPath, [join("node_modules", "es-check", "lib", "cli", "index.js"), "es2016", "--noColor", ...js], { stdio: "pipe" });
} catch (e) {
  problems.push(`sintaxis JS más nueva que ES2016:\n${String(e.stdout || "") + String(e.stderr || "")}`.trim());
}

// Funciones que Chromium 53 no tiene ni están en los polyfills: solo aviso (las librerías pueden detectarlas).
const WARN = [/\bAbortController\b/, /\bResizeObserver\b/, /\.replaceAll\(/, /\bstructuredClone\(/, /\bPromise\.allSettled\b/];
const code = js.map((f) => readFileSync(f, "utf8")).join("\n");
for (const re of WARN) if (re.test(code)) console.warn(`aviso: el JS menciona ${re.source}; verifica que no se use sin comprobar si existe.`);

if (problems.length) {
  console.error("Incompatible con webOS 4.x (Chromium 53):\n- " + problems.join("\n- "));
  process.exit(1);
}
const kb = (f) => Math.round(readFileSync(f).length / 1024);
console.log(`compatibilidad Chromium 53: OK (${js.map((f) => `${f} ${kb(f)} KB`).join(", ")})`);
