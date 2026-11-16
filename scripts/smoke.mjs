/**
 * Prueba de humo con Chrome (playwright-core + el Chrome instalado), manejando la app solo con el
 * teclado como si fuera el control remoto. Necesita el panel falso (`npm run fake-panel`).
 *
 *   node scripts/smoke.mjs <url> <carpeta-capturas>
 *   url: http://127.0.0.1:5173 (npm run dev, con video vía hls.js) o file:///…/dist/index.html (build del TV)
 *
 * Un build para esta prueba se hace con VITE_PANEL_URL=http://127.0.0.1:8899.
 * Cada corrida parte con el almacenamiento vacío. Sale con código 1 si algún paso falla.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const url = process.argv[2] || "http://127.0.0.1:5173";
const out = process.argv[3] || "smoke-shots";
const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  // Los 404 (logos rotos, canales que fallan a propósito) son parte del panel falso.
  if (m.type() === "error" && !/status of 404/.test(m.text())) errors.push(`console: ${m.text()}`);
});

let n = 0;
let failed = 0;
const shot = async (name) => {
  await page.screenshot({ path: join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
};
const wait = (ms) => page.waitForTimeout(ms);
const key = async (k, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(k);
    await wait(130);
  }
};
/** Texto del elemento con foco (o "nada"). */
const focused = () =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return "nada";
    return (a.textContent || a.getAttribute("aria-label") || a.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 60);
  });
const video = () =>
  page.evaluate(() => {
    const v = document.querySelector("video");
    return v ? { t: Number(v.currentTime.toFixed(1)), ready: v.readyState, paused: v.paused, w: v.videoWidth } : null;
  });
const text = () => page.evaluate(() => document.body.innerText);
const waitText = (re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), re.source, { timeout }).then(
    () => true,
    () => false,
  );
const playing = (v) => !!v && v.ready >= 3 && !v.paused && v.w > 0;

async function check(what, ok, detail) {
  console.log(`${ok ? "OK   " : "FALLO"} ${what}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
  await shot(what.replace(/[^a-z0-9áéíóúñ]+/gi, "-").toLowerCase().slice(0, 60));
}

/** Atrás hasta la barra lateral y de ahí a una sección (por su posición respecto de la actual). */
async function goSection(steps) {
  await key("Escape");
  await wait(300);
  await key(steps > 0 ? "ArrowDown" : "ArrowUp", Math.abs(steps));
  await key("Enter");
  await wait(800);
}

await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await wait(800);
await check("login con foco en usuario", /usuario/i.test(await focused()), await focused());

await page.keyboard.type("demo");
await key("ArrowDown");
await page.keyboard.type("demo");
await key("ArrowDown");
await key("Enter");

/* ---------- Inicio ---------- */

await waitText(/Películas recientes/, 25000);
await wait(1200);
await check("inicio con portada y foco en Reproducir", /Reproducir/.test(await focused()) && /Destacado/i.test(await text()), await focused());
// Las filas más abajo todavía no existen en el DOM (virtualización).
await check("inicio tiene filas de películas y series", /Series recientes/.test(await text()));

await key("ArrowDown");
await wait(400);
await check("abajo entra a la primera fila", /Película de prueba 2500/.test(await focused()), await focused());
await key("ArrowRight", 3);
await wait(300);
const col3 = await focused();
await key("ArrowDown");
await wait(300);
await check("bajar a la fila de series", /Serie de prueba 600/.test(await focused()), await focused());
await key("ArrowUp");
await wait(300);
await check("subir vuelve a la misma tarjeta", (await focused()) === col3, `${await focused()} (antes: ${col3})`);

/* ---------- Ficha y reproductor de película ---------- */

await key("Enter");
await waitText(/Directora de Prueba/);
await wait(500);
await check("ficha de película con datos y foco en Reproducir", /Reproducir/.test(await focused()), await focused());

await key("Enter");
await wait(5000);
let v = await video();
await check("película reproduce a pantalla completa", playing(v) && v.t > 1, JSON.stringify(v));

const t0 = (await video()).t;
await key("ArrowRight", 2);
await wait(2000);
v = await video();
await check("→ → adelanta 20 s", !!v && v.t >= t0 + 18, `${t0} → ${v && v.t}`);

await key("Escape"); // oculta los controles
await wait(300);
await key("Escape"); // vuelve a la ficha
await wait(800);
await check("Atrás vuelve a la ficha con Continuar", /Continuar/.test(await focused()) && /Desde el inicio/.test(await text()), await focused());

await key("Escape");
await wait(800);
await check("Atrás vuelve a Inicio en la misma tarjeta", (await focused()) === col3, await focused());
await key("ArrowUp", 3);
await wait(400);
await check("inicio muestra Seguir viendo", /Seguir viendo/.test(await text()), await focused());

/* ---------- Películas: categorías y grilla ---------- */

await goSection(2); // Inicio → Películas
await waitText(/Categorías/);
await wait(800);
await check("películas con portada", /Reproducir/.test(await focused()), await focused());
await key("ArrowRight", 2);
await key("Enter");
await wait(500);
await check("abre el selector de categorías", /Categorías/.test(await text()) && /Noticias/.test(await focused()), await focused());
await key("ArrowDown", 2);
await key("Enter");
await wait(800);
await check("elegir una categoría abre la grilla", /313 películas/.test(await text()) || /312 películas/.test(await text()), await focused());
await key("ArrowRight");
await key("ArrowDown");
await wait(400);
const gridFocus = await focused();
await check("moverse en la grilla", /Película de prueba/.test(gridFocus), gridFocus);
await key("ArrowUp", 2);
await wait(300);
await check("arriba desde la primera fila sube al buscador de la categoría", /Buscar en esta categoría/.test(await focused()), await focused());
await page.keyboard.type("1999");
await wait(900);
const filtered = await text();
await check("el buscador filtra la categoría", /\d+ de 31[23] películas/.test(filtered) && /\(1999\)/.test(filtered), (filtered.match(/\d+ de \d+ películas/) || [""])[0]);
await key("ArrowDown");
await wait(400);
await check("abajo vuelve a la grilla filtrada", /\(1999\)/.test(await focused()), await focused());
await key("Escape");
await wait(600);
await check("Atrás cierra la grilla y vuelve a Categorías", /Categorías/.test(await focused()), await focused());

/* ---------- Series: ficha, temporadas y episodio ---------- */

await goSection(1); // Películas → Series
await waitText(/Ver serie/);
await wait(800);
await key("ArrowDown");
await key("ArrowRight");
await wait(300);
await check("series: tarjeta de la serie 599", /Serie de prueba 599/.test(await focused()), await focused());
await key("Enter");
await waitText(/Ver T1 · E1/);
await wait(600);
await check("ficha de serie con foco en Ver T1 · E1", /Ver T1 · E1/.test(await focused()), await focused());
await key("ArrowDown");
await wait(300);
await check("bajar a las temporadas", /Temporada 1/.test(await focused()), await focused());
await key("ArrowRight");
await wait(700);
await key("ArrowDown");
await wait(400);
await check("cambiar a la temporada 2 muestra sus episodios", /1\. Capítulo 1/.test(await focused()) && /Temporada 2/.test(await text()), await focused());
await key("ArrowRight");
await wait(300);
const ep = await focused();
await key("Enter");
await wait(3000); // antes de que se oculten los controles (4,5 s)
v = await video();
await check("episodio reproduce con su código", playing(v) && /T2 · E2/.test(await text()), JSON.stringify(v));
await key("Escape"); // oculta los controles
await wait(300);
await key("Escape"); // vuelve a la ficha
await wait(800);
await check("Atrás vuelve al mismo episodio", (await focused()) === ep, await focused());
await key("Escape");
await wait(600);

/* ---------- En vivo ---------- */

await goSection(-2); // Series → En vivo
await page.waitForSelector('[data-nav-zone="live-chs"] [data-index]', { timeout: 20000 });
await wait(800);
await check("en vivo con foco en el canal 1", /Deportes 1 HD/.test(await focused()), await focused());

// El canal 1 falla a propósito (HLS y TS dan 404).
await key("Enter");
await wait(3000);
await check("canal que falla muestra el error", /No se pudo reproducir/.test(await text()));

await key("ArrowDown", 3);
await key("Enter");
await wait(7000);
v = await video();
await check("vista previa reproduce", playing(v) && v.t > 1, JSON.stringify(v));

await key("Enter");
await wait(1500);
await check("pantalla completa toma el foco", /HLS/.test(await focused()), await focused());

await key("ArrowRight", 2);
await key("Enter");
await wait(400);
await check("agregar el canal a favoritos", /Favorito/.test(await focused()), await focused());

await key("PageUp"); // CH+
await wait(4000);
v = await video();
await check("CH+ pasa al canal 5", /Noticias 5/.test(await text()) && !!v && v.t > 0.5, JSON.stringify(v));

await wait(5500); // se oculta la barra
await key("ArrowDown");
await wait(400);
await check("↓ muestra las opciones sin cambiar de canal", /Noticias 5/.test(await text()) && /HLS|TS|Favorito|favoritos/.test(await focused()), await focused());

await key("Escape"); // oculta la barra
await wait(300);
await key("Escape"); // sale de pantalla completa
await wait(600);
await check("Atrás vuelve a la lista en el canal 5", /Noticias 5/.test(await focused()), await focused());

await key("ArrowLeft");
await key("ArrowDown", 1);
await wait(900);
let heading = await page.evaluate(() => document.querySelectorAll("h2")[1]?.textContent || "");
await check("aparece la carpeta Favoritos con el canal 4", /Favoritos/.test(heading) && /Infantil 4/.test(await text()), heading);
await key("ArrowDown", 2);
await wait(900);
heading = await page.evaluate(() => document.querySelectorAll("h2")[1]?.textContent || "");
await check("pasar por las carpetas cambia la lista", /CL \| Deportes/.test(heading), heading);

await key("1");
await key("2");
await wait(300);
await check("el número tecleado aparece en pantalla", /\b12\b/.test(await text()));
await wait(2500);
await check("teclear 12 salta al canal 12", /Películas 12/.test(await focused()), await focused());

/* ---------- De vuelta en Inicio ---------- */

await goSection(-1); // En vivo → Inicio
await waitText(/Seguir viendo/);
await wait(600);
await key("ArrowDown", 2);
await wait(500);
await check("inicio: fila de canales favoritos", /Canales favoritos/.test(await text()) && /Infantil 4/.test(await focused()), await focused());
await key("ArrowDown");
await wait(500);
// El último canal visto (el 12) va primero.
await check("inicio: fila de canales vistos recientemente", /Vistos recientemente/.test(await text()) && /Películas 12/.test(await focused()), await focused());
await key("Enter");
await wait(4000);
v = await video();
await check("un canal desde Inicio abre En vivo a pantalla completa", playing(v) && /Películas 12/.test(await text()), JSON.stringify(v));
await key("Escape");
await wait(300);
await key("Escape");
await wait(600);
await check("Atrás deja la lista de En vivo en ese canal", /Películas 12/.test(await focused()), await focused());
await goSection(-1); // En vivo → Inicio
await waitText(/Seguir viendo/);
await wait(600);

/* ---------- Buscar ---------- */

await goSection(-1); // Inicio → Buscar
await wait(400);
await check("buscar con foco en el campo", /Canal, película o serie/.test(await focused()) && /Busca canales/.test(await text()), await focused());
await page.keyboard.type("pelicula 12");
await waitText(/\d+ resultados/);
await wait(300);
const found = await text();
await check("busca sin tildes en canales y películas", /Canales/.test(found) && /Película de prueba 12/.test(found), (found.match(/\d+ resultados/) || [""])[0]);
await key("ArrowDown");
await wait(400);
// Primero la fila con el resultado más parecido (la película 12 empieza con "Película … 12" palabra por palabra).
await check("abajo entra a los resultados, el más parecido primero", /Película de prueba 12 \(/.test(await focused()), await focused());
await key("ArrowDown");
await wait(400);
// Palabra entera antes que comienzo de palabra: el canal 12 antes que el 122 o el 212.
await check("en canales, el 12 antes que el 122", /Películas 12\b/.test(await focused()), await focused());
await key("Enter");
await wait(4000);
v = await video();
await check("un canal encontrado abre En vivo a pantalla completa", playing(v) && /Películas 12\b/.test(await text()), JSON.stringify(v));
await key("Escape"); // oculta la barra
await wait(300);
await key("Escape"); // vuelve a la lista
await wait(600);
await goSection(-2); // En vivo → Buscar
await wait(400);
await check("la búsqueda queda entre las recientes", /Búsquedas recientes/.test(await text()) && /pelicula 12/.test(await text()));
await goSection(1); // Buscar → Inicio
await waitText(/Seguir viendo/);
await wait(600);

await key("Escape");
await wait(400);
await check("Atrás desde el contenido va a la barra lateral", /Inicio/.test(await focused()), await focused());
await key("ArrowDown", 4);
await key("Enter");
await wait(1500);
await check("abre Cuenta", /Actualizar catálogo|Cerrar sesión/.test(await text()), await focused());

await key("Escape");
await wait(300);
await key("Escape");
await wait(400);
await check("Atrás en la barra pregunta si salir", /Salir de/.test(await text()), await focused());

await key("Escape");
await wait(300);
await check("Atrás cierra el diálogo", !/Salir de/.test(await text()), await focused());

console.log(errors.length ? `ERRORES EN LA CONSOLA:\n${errors.join("\n")}` : "sin errores en la consola");
console.log(failed ? `${failed} paso(s) fallaron` : "todo OK");
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
