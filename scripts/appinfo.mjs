/**
 * Después de `vite build`: escribe dist/appinfo.json (el manifiesto de la app para webOS) y los
 * íconos, con los datos de .env.local. Si existen brand/icon.png (80×80) y brand/largeIcon.png
 * (130×130), se usan esos; si no, se dibuja el de Lytra TV con el color de marca.
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
const name = (env.VITE_BRAND_NAME || "").trim() || "Lytra TV";
const color = /^#[0-9a-f]{6}$/i.test((env.VITE_BRAND_COLOR || "").trim()) ? env.VITE_BRAND_COLOR.trim() : "#a78bfa";

const CUSTOM_ICONS = existsSync("brand/icon.png") || existsSync("brand/largeIcon.png");

const appinfo = {
  id,
  version,
  vendor: (env.APP_VENDOR || name).trim(),
  type: "web",
  main: "index.html",
  title: name,
  icon: "icon.png",
  largeIcon: "largeIcon.png",
  // Fondo del ícono en el launcher: el tono medio del degradado de Lytra.
  // Con íconos propios del revendedor, su color de marca.
  iconColor: CUSTOM_ICONS ? color : "#1c1f28",
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

/**
 * Ícono por defecto: el símbolo de Lytra TV (el mismo de `src/ui/Brand.tsx`) en el color de marca,
 * sobre el degradado nocturno de Lytra. Va a sangre completa, sin esquinas ni borde: el launcher del
 * TV ya lo pone en su propia tarjeta, y un cuadro propio se veía como un marco dentro de otro (probado
 * en el TV, 2026-11-15). Se dibuja en una grilla de 64 unidades, con el símbolo en las 48 del centro
 * (en su grilla de 24) y suavizado 5×5.
 */
function drawIcon(size) {
  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const brand = hex(color);
  const top = hex("#232733"), bottom = hex("#15171d");
  const mix = (a, b, t) => [0, 1, 2].map((k) => a[k] * (1 - t) + b[k] * t);

  const inRect = (x, y, rx, ry, w, h, r) => {
    if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
    const cx = Math.min(Math.max(x, rx + r), rx + w - r);
    const cy = Math.min(Math.max(y, ry + r), ry + h - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };

  // Cartas de 9 × 12.6, de atrás hacia adelante. Cada una pierde lo que tapa la siguiente agrandada 1.5.
  const CARDS = [
    { x: 3, y: 2, o: 0.4, cut: [5.5, 4.2] },
    { x: 7, y: 5.7, o: 0.7, cut: [9.5, 7.9] },
    { x: 11, y: 9.4, o: 1, cut: null },
  ];

  // El play calado: el triángulo más 0.55 alrededor (el trazo redondo de 1.1 del SVG).
  const T = [[14.55, 13.55], [14.55, 17.85], [18.05, 15.7]];
  const side = (px, py, a, b) => (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
  const segDist = (px, py, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
  };
  const inPlay = (x, y) => {
    const d1 = side(x, y, T[0], T[1]), d2 = side(x, y, T[1], T[2]), d3 = side(x, y, T[2], T[0]);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true;
    return Math.min(segDist(x, y, T[0], T[1]), segDist(x, y, T[1], T[2]), segDist(x, y, T[2], T[0])) <= 0.55;
  };

  // Degradado del cuadro: de (0.33, 0.03) a (0.67, 0.97) del ancho y el alto.
  const g0 = [21.12, 1.92], gd = [21.76, 60.16], gl = gd[0] * gd[0] + gd[1] * gd[1];

  const S = 5;
  return png(size, (x, y) => {
    let n = 0;
    const sum = [0, 0, 0];
    for (let i = 0; i < S; i++)
      for (let j = 0; j < S; j++) {
        const u = ((x + (i + 0.5) / S) * 64) / size, v = ((y + (j + 0.5) / S) * 64) / size;
        n++;
        const t = Math.max(0, Math.min(1, ((u - g0[0]) * gd[0] + (v - g0[1]) * gd[1]) / gl));
        let c = mix(top, bottom, t);
        const mx = ((u - 8) * 24) / 48, my = ((v - 8) * 24) / 48;
        for (const k of CARDS) {
          if (!inRect(mx, my, k.x, k.y, 9, 12.6, 1.7)) continue;
          if (k.cut ? inRect(mx, my, k.cut[0], k.cut[1], 12, 15.6, 3) : inPlay(mx, my)) continue;
          c = mix(c, brand, k.o);
        }
        for (let k = 0; k < 3; k++) sum[k] += c[k];
      }
    if (!n) return [0, 0, 0, 0];
    return [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n), Math.round((n / (S * S)) * 255)];
  });
}

for (const [file, size] of [["icon.png", 80], ["largeIcon.png", 130]]) {
  const custom = `brand/${file}`;
  if (existsSync(custom)) copyFileSync(custom, `dist/${file}`);
  else writeFileSync(`dist/${file}`, drawIcon(size));
}

console.log(`appinfo.json: ${id} ${version} "${name}"`);
