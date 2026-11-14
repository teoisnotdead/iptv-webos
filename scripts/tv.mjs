/**
 * Atajos para el TV con la CLI de webOS (`@webos-tools/cli`, instalada como dependencia de desarrollo):
 *   node scripts/tv.mjs package   → out/<id>_<versión>_all.ipk desde dist/
 *   node scripts/tv.mjs install   → instala ese .ipk en el TV
 *   node scripts/tv.mjs launch    → abre la app
 *   node scripts/tv.mjs inspect   → abre el inspector web de la app (consola, red)
 * El TV se configura una vez con `npx ares-setup-device` (ver README). Su nombre va en WEBOS_DEVICE.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { loadEnv } from "vite";

const env = loadEnv("production", process.cwd(), "");
const device = (env.WEBOS_DEVICE || "tv").trim();
const cmd = process.argv[2];

function appinfo() {
  if (!existsSync("dist/appinfo.json")) {
    console.error("Falta dist/appinfo.json: corre primero `npm run build`.");
    process.exit(1);
  }
  return JSON.parse(readFileSync("dist/appinfo.json", "utf8"));
}

function run(bin, args) {
  const r = spawnSync(bin, args, { stdio: "inherit", shell: process.platform === "win32" });
  process.exit(r.status ?? 1);
}

const info = appinfo();
const ipk = `out/${info.id}_${info.version}_all.ipk`;

switch (cmd) {
  case "package":
    // -n: no volver a minificar (el build ya viene minificado para Chromium 53).
    run("ares-package", ["dist", "-o", "out", "-n"]);
    break;
  case "install":
    if (!existsSync(ipk)) {
      console.error(`No existe ${ipk}: corre primero \`npm run package\`.`);
      process.exit(1);
    }
    run("ares-install", ["-d", device, ipk]);
    break;
  case "launch":
    run("ares-launch", ["-d", device, info.id]);
    break;
  case "inspect":
    run("ares-inspect", ["-d", device, "--app", info.id, "--open"]);
    break;
  default:
    console.error("Uso: node scripts/tv.mjs package | install | launch | inspect");
    process.exit(1);
}
