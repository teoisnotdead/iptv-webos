/**
 * Después de `vite build`: escribe dist/appinfo.json (el manifiesto de la app para webOS) y los
 * íconos, con los datos de .env.local. Si existen brand/icon.png (80×80) y brand/largeIcon.png
 * (130×130), se usan esos; si no, se dibuja uno con el color de marca.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { loadEnv } from "vite";

const env = loadEnv("production", process.cwd(), "");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const id = (env.APP_ID || "app.iptv.player").trim();
if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(id) || /^com\.(lge|webos|palm)\b/.test(id)) {
  console.error(`APP_ID inválido: "${id}". Usa minúsculas estilo dominio invertido (p. ej. app.mimarca.tv) y no empieces con com.lge, com.webos ni com.palm.`);
  process.exit(1);
}
const version = (env.APP_VERSION || pkg.version).trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`APP_VERSION inválida: "${version}" (debe ser x.y.z, solo números).`);
  process.exit(1);
}
const name = (env.VITE_BRAND_NAME || "").trim() || "IPTV";
const color = /^#[0-9a-f]{6}$/i.test((env.VITE_BRAND_COLOR || "").trim()) ? env.VITE_BRAND_COLOR.trim() : "#a78bfa";

const appinfo = {
  id,
  version,
  vendor: (env.APP_VENDOR || name).trim(),
  type: "web",
  main: "index.html",
  title: name,
  icon: "icon.png",
  largeIcon: "largeIcon.png",
  iconColor: color,
  resolution: "1920x1080",
  // La app maneja la tecla Atrás (pregunta antes de salir) en vez del historial del navegador.
  disableBackHistoryAPI: true,
  // La app no usa APIs Luna; LG pide declararlo vacío (los webOS antiguos ignoran el campo).
  requiredACG: [],
};
writeFileSync("dist/appinfo.json", JSON.stringify(appinfo, null, 2) + "\n");

/* ---------- íconos ---------- */

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Cuadrado redondeado con el color de marca y un triángulo de "play" (con suavizado 4×4). */
function drawIcon(size) {
  const n = parseInt(color.slice(1), 16);
  const bg = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
  const fg = lum > 0.6 ? [18, 14, 31] : [255, 255, 255];
  const r = size * 0.22;
  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  // Triángulo apuntando a la derecha, algo corrido para que se vea centrado.
  const ax = size * 0.38, ay = size * 0.28, bx = size * 0.38, by = size * 0.72, cx = size * 0.74, cy = size * 0.5;
  const side = (px, py, x1, y1, x2, y2) => (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
  const inTri = (x, y) => {
    const d1 = side(x, y, ax, ay, bx, by), d2 = side(x, y, bx, by, cx, cy), d3 = side(x, y, cx, cy, ax, ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const S = 4;
  return png(size, (x, y) => {
    let cover = 0, tri = 0;
    for (let i = 0; i < S; i++)
      for (let j = 0; j < S; j++) {
        const px = x + (i + 0.5) / S, py = y + (j + 0.5) / S;
        if (inRounded(px, py)) {
          cover++;
          if (inTri(px, py)) tri++;
        }
      }
    if (!cover) return [0, 0, 0, 0];
    const t = tri / cover;
    const mix = (k) => Math.round(bg[k] * (1 - t) + fg[k] * t);
    return [mix(0), mix(1), mix(2), Math.round((cover / (S * S)) * 255)];
  });
}

for (const [file, size] of [["icon.png", 80], ["largeIcon.png", 130]]) {
  const custom = `brand/${file}`;
  if (existsSync(custom)) copyFileSync(custom, `dist/${file}`);
  else writeFileSync(`dist/${file}`, drawIcon(size));
}

console.log(`appinfo.json: ${id} ${version} "${name}"`);
