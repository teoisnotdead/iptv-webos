/**
 * Escribe usuario y contraseña en el login de la app que corre en el TV, sin usar el control remoto.
 * Va por el inspector remoto: primero corre `npm run tv:inspect` (o `npx ares-inspect -d tv --app <id>`)
 * y usa el puerto que muestra ("http://localhost:<puerto>/devtools/...").
 *
 *   node scripts/tv-login.mjs <puerto>
 *
 * Pide los datos aquí (la contraseña no se muestra) y no los guarda ni los registra en ningún lado.
 */
import { createInterface } from "node:readline";

const port = process.argv[2];
if (!port) {
  console.error("Uso: node scripts/tv-login.mjs <puerto del inspector>");
  process.exit(1);
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // No mostrar lo que se escribe (solo la pregunta).
      rl._writeToOutput = (s) => {
        if (s.indexOf(question) === 0) process.stdout.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const pages = await fetch(`http://localhost:${port}/json`).then((r) => r.json(), () => null);
const page = Array.isArray(pages) ? pages.find((p) => p.type === "page") : null;
if (!page) {
  console.error(`No encontré la app en el inspector (puerto ${port}). ¿Está corriendo ares-inspect?`);
  process.exit(1);
}

const username = (await ask("Usuario: ")).trim();
const password = await ask("Contraseña: ", true);

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const waiting = new Map();
const call = (method, params) =>
  new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  }
};

const evaluate = async (expression) => (await call("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;

ws.onopen = async () => {
  // Llena los campos como si se hubiera escrito (el evento `input` actualiza el estado de la app) y toca Entrar.
  const fill = `(function (u, p) {
    var inputs = document.querySelectorAll("input"), user = null, pass = null;
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].type === "password") pass = inputs[i];
      else if (inputs[i].type !== "url") user = inputs[i];
    }
    if (!user || !pass) return "No está la pantalla de login.";
    function set(el, v) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }
    set(user, u);
    set(pass, p);
    setTimeout(function () {
      var buttons = document.querySelectorAll("button");
      for (var j = 0; j < buttons.length; j++) if (buttons[j].textContent.trim() === "Entrar") buttons[j].click();
    }, 150);
    return "ok";
  })(${JSON.stringify(username)}, ${JSON.stringify(password)})`;

  const r = await evaluate(fill);
  if (r !== "ok") {
    console.log(r || "No se pudo escribir en el TV.");
    process.exit(1);
  }
  console.log("Datos enviados al TV. Esperando la respuesta del panel…");
  await new Promise((res) => setTimeout(res, 6000));
  const after = await evaluate(
    // innerText no incluye lo escrito en los campos: aquí solo sale el mensaje de error, si lo hay.
    `(function () { var t = document.body.innerText; if (document.querySelector("input[type=password]")) return "Sigue en el login: " + t.replace(/\\s+/g, " ").slice(0, 200); return "Sesión iniciada."; })()`,
  );
  console.log(after);
  ws.close();
  process.exit(0);
};
ws.onerror = () => {
  console.error("No se pudo conectar al inspector del TV.");
  process.exit(1);
};
