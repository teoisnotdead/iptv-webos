/**
 * Panel Xtream falso para probar la app sin un servicio real (`npm run fake-panel`).
 *   http://127.0.0.1:8899  ·  usuario demo / contraseña demo  (vencido / demo → cuenta vencida)
 * Miles de canales, películas y series para probar la virtualización. Algunos canales fallan a propósito.
 * Responde CORS igual que los paneles reales: devuelve el mismo `Origin` que recibe.
 *
 * Video: al arrancar genera con ffmpeg (una sola vez, en node_modules/.cache/fake-panel) 60 s de
 * imagen de prueba con tono. Los canales redirigen (302, como los paneles reales) a un HLS "en vivo"
 * que avanza con el reloj, y el .ts es un MPEG-TS continuo. Películas y episodios redirigen a un MP4
 * con soporte de Range. Sin ffmpeg se usa un stream público de prueba.
 */
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const PORT = Number(process.env.FAKE_PANEL_PORT || 8899);
const PUBLIC_STREAM = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

const MEDIA = join(process.cwd(), "node_modules", ".cache", "fake-panel");
const SEGS = 15;
const segFile = (i) => join(MEDIA, "live", `seg_${String(i).padStart(3, "0")}.ts`);

/** Genera el material de prueba si falta. Devuelve false si no hay ffmpeg. */
function makeMedia() {
  if (existsSync(join(MEDIA, "vod.mp4")) && existsSync(segFile(SEGS - 1))) return true;
  mkdirSync(join(MEDIA, "live"), { recursive: true });
  const ff = process.env.FFMPEG || "ffmpeg";
  const input = (hz) => ["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25", "-f", "lavfi", "-i", `sine=frequency=${hz}:sample_rate=48000`];
  const enc = ["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-g", "50", "-keyint_min", "50", "-sc_threshold", "0", "-c:a", "aac", "-b:a", "128k", "-ac", "2"];
  console.log("Generando video de prueba con ffmpeg…");
  const run = (args) => spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" }).status === 0;
  return (
    run([...input(440), "-t", String(4 * SEGS), ...enc, "-f", "hls", "-hls_time", "4", "-hls_list_size", "0", "-hls_segment_filename", join(MEDIA, "live", "seg_%03d.ts"), join(MEDIA, "live", "index.m3u8")]) &&
    run([...input(660), "-t", "180", ...enc, "-movflags", "+faststart", join(MEDIA, "vod.mp4")])
  );
}

const HAS_MEDIA = makeMedia();
if (!HAS_MEDIA) console.warn("Sin ffmpeg: los streams redirigen a", PUBLIC_STREAM);

/** Duración de cada segmento, leída del playlist que escribió ffmpeg. */
const SEG_DUR = HAS_MEDIA
  ? [...readFileSync(join(MEDIA, "live", "index.m3u8"), "utf8").matchAll(/#EXTINF:([\d.]+)/g)].map((m) => Number(m[1]))
  : [];
const T0 = Date.now() / 1000;

/**
 * Playlist en vivo: una ventana de 6 segmentos que avanza con el reloj. Los 15 segmentos se repiten
 * en bucle, con EXT-X-DISCONTINUITY en cada vuelta (como un canal real que reinicia el encoder).
 */
function livePlaylist() {
  const target = 4;
  const last = Math.floor((Date.now() / 1000 - T0) / target) + 5;
  const first = last - 5;
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", `#EXT-X-TARGETDURATION:${target}`, `#EXT-X-MEDIA-SEQUENCE:${first}`, `#EXT-X-DISCONTINUITY-SEQUENCE:${Math.floor(first / SEGS)}`];
  for (let i = first; i <= last; i++) {
    if (i > first && i % SEGS === 0) lines.push("#EXT-X-DISCONTINUITY");
    lines.push(`#EXTINF:${SEG_DUR[i % SEGS].toFixed(3)},`, `seg/${i}.ts`);
  }
  return lines.join("\n") + "\n";
}

/** MPEG-TS continuo (lo que entrega un panel en `.ts`): los segmentos uno tras otro, a ritmo real. */
function liveTs(req, res) {
  res.writeHead(200, { "Content-Type": "video/mp2t" });
  let i = 0;
  let closed = false;
  req.on("close", () => (closed = true));
  const pump = () => {
    if (closed) return;
    const k = i++ % SEGS;
    const s = createReadStream(segFile(k));
    s.on("end", () => setTimeout(pump, i <= 2 ? 0 : SEG_DUR[k] * 1000));
    s.pipe(res, { end: false });
  };
  pump();
}

/** Archivo con soporte de Range (para adelantar en películas). */
function sendFile(req, res, file, type) {
  const size = statSync(file).size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (!m || (m[1] === "" && m[2] === "")) {
    res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
    return createReadStream(file).pipe(res);
  }
  const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] === "" || m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || start > end) {
    res.writeHead(416, { "Content-Range": `bytes */${size}` });
    return res.end();
  }
  res.writeHead(206, { "Content-Type": type, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes" });
  createReadStream(file, { start, end }).pipe(res);
}

const COUNTRIES = ["CL", "AR", "ES", "MX", "US", "CO", "PE"];
const GENRES = ["Noticias", "Deportes", "Películas", "Series", "Infantil", "Documentales", "Música", "Entretenimiento"];

const liveCats = [];
for (const c of COUNTRIES) for (const g of GENRES.slice(0, 5)) liveCats.push({ category_id: String(liveCats.length + 1), category_name: `${c} | ${g}`, parent_id: 0 });

const channels = [];
for (let i = 1; i <= 4200; i++) {
  const cat = liveCats[i % liveCats.length];
  const country = cat.category_name.slice(0, 2);
  channels.push({
    num: i,
    name: `${country} | ${cat.category_name.slice(5)} ${i}${i % 3 === 0 ? " FHD" : i % 3 === 1 ? " HD" : ""}`,
    stream_type: "live",
    stream_id: 1000 + i,
    // Un tercio con logo, uno con logo roto y uno sin logo.
    stream_icon: i % 3 === 0 ? `http://127.0.0.1:${PORT}/logo/${1000 + i}.svg` : i % 3 === 1 ? `http://127.0.0.1:${PORT}/no-existe/${i}.png` : "",
    epg_channel_id: i % 5 === 0 ? `canal${i}.cl` : null,
    category_id: cat.category_id,
  });
}
// Un canal repetido y uno con id inválido, como hacen algunos paneles.
channels.push({ ...channels[0] }, { name: "Roto", stream_id: "0", category_id: "1" });

const vodCats = GENRES.map((g, i) => ({ category_id: String(100 + i), category_name: g }));
const NOW = Math.floor(Date.now() / 1000);
const movies = [];
for (let i = 1; i <= 2500; i++) {
  movies.push({
    num: i,
    name: `Película de prueba ${i} (${1980 + (i % 45)})`,
    stream_id: 50000 + i,
    stream_icon: i % 4 === 0 ? "" : `http://127.0.0.1:${PORT}/poster/${i}.svg`,
    rating: String((i % 90) / 10),
    category_id: vodCats[i % vodCats.length].category_id,
    container_extension: i % 2 ? "mp4" : "mkv",
    // Las de número más alto son las más nuevas.
    added: String(NOW - (2501 - i) * 3600),
  });
}
const shows = [];
for (let i = 1; i <= 600; i++) {
  shows.push({
    series_id: 9000 + i,
    name: `Serie de prueba ${i}`,
    cover: `http://127.0.0.1:${PORT}/poster/s${i}.svg`,
    rating: String(5 + (i % 50) / 10),
    category_id: vodCats[i % vodCats.length].category_id,
    last_modified: String(NOW - (601 - i) * 7200),
  });
}

const PLOT =
  "Una historia de prueba para ver cómo se ve la ficha en el TV: el texto ocupa varias líneas, igual que las sinopsis reales que mandan los paneles, y se corta con puntos suspensivos si es muy largo.";

/** Ficha de película (get_vod_info). Una de cada tres no trae imagen de fondo. */
function vodInfo(id) {
  const i = id - 50000;
  const mv = movies[i - 1];
  if (!mv) return {};
  return {
    info: {
      name: mv.name,
      plot: PLOT,
      genre: `${GENRES[i % GENRES.length]}, ${GENRES[(i + 3) % GENRES.length]}`,
      director: "Directora de Prueba",
      cast: "Actriz Uno, Actor Dos, Actriz Tres, Actor Cuatro",
      releasedate: `${1980 + (i % 45)}-05-12`,
      duration: "01:52:00",
      duration_secs: 6720,
      rating: mv.rating,
      movie_image: mv.stream_icon,
      backdrop_path: i % 3 === 0 ? [] : [`http://127.0.0.1:${PORT}/backdrop/m${i}.svg`],
    },
    movie_data: { stream_id: id, name: mv.name, container_extension: mv.container_extension },
  };
}

/**
 * Ficha de serie (get_series_info): de 1 a 4 temporadas. Una de cada cinco manda los episodios como
 * arreglo de arreglos (como algunos paneles) y con títulos tipo "S01E02".
 */
function seriesInfo(id) {
  const i = id - 9000;
  const sh = shows[i - 1];
  if (!sh) return {};
  const seasons = 1 + (i % 4);
  const groups = [];
  for (let s = 1; s <= seasons; s++) {
    const eps = [];
    const count = 6 + ((i + s) % 7);
    for (let e = 1; e <= count; e++) {
      eps.push({
        id: String(id * 1000 + s * 100 + e),
        episode_num: e,
        season: s,
        title: i % 5 === 0 ? `${sh.name} S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}` : `Capítulo ${e}`,
        container_extension: "mp4",
        info: { duration: "00:45:00", plot: PLOT, movie_image: `http://127.0.0.1:${PORT}/thumb/${id}-${s}-${e}.svg` },
      });
    }
    groups.push(eps);
  }
  const episodes = i % 5 === 0 ? groups : Object.fromEntries(groups.map((g, k) => [String(k + 1), g]));
  return {
    info: {
      name: sh.name,
      cover: sh.cover,
      plot: PLOT,
      genre: GENRES[i % GENRES.length],
      releaseDate: `${1995 + (i % 30)}-01-01`,
      rating: sh.rating,
      backdrop_path: i % 3 === 0 ? [] : [`http://127.0.0.1:${PORT}/backdrop/s${i}.svg`],
    },
    episodes,
  };
}

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

function epgFor(streamId) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % 3600);
  const titles = ["Noticiero central", "Fútbol: resumen de la fecha", "Documental: la Patagonia", "Película de la noche"];
  return {
    epg_listings: titles.map((t, k) => ({
      id: String(k),
      title: b64(k === 3 && streamId % 2 ? "Sin información" : t),
      description: b64("Descripción de prueba"),
      start_timestamp: String(start + k * 3600),
      stop_timestamp: String(start + (k + 1) * 3600),
    })),
  };
}

function account(username, password) {
  const ok = (username === "demo" && password === "demo") || (username === "vencido" && password === "demo");
  if (!ok) return { user_info: { auth: 0 } };
  const exp = Math.floor(Date.now() / 1000) + (username === "vencido" ? -86400 * 3 : 86400 * 23);
  return {
    user_info: { username, password, auth: 1, status: username === "vencido" ? "Expired" : "Active", exp_date: String(exp), max_connections: "2", active_cons: "0" },
    server_info: { url: "127.0.0.1", port: String(PORT), timezone: "America/Santiago" },
  };
}

function svg(text, w, h, hue) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="hsl(${hue},45%,35%)"/><text x="50%" y="55%" font-family="sans-serif" font-size="${Math.round(h / 4)}" fill="#fff" text-anchor="middle">${text}</text></svg>`;
}

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, { "Content-Type": type });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  const p = url.pathname;
  if (!/^\/(stream|logo|poster|backdrop|thumb|no-existe)\//.test(p)) console.log(req.method, p, url.searchParams.get("action") || "");

  if (p === "/player_api.php") {
    const u = url.searchParams.get("username") || "";
    const pw = url.searchParams.get("password") || "";
    const acc = account(u, pw);
    const action = url.searchParams.get("action");
    if (!action) return send(200, acc);
    if (acc.user_info.auth !== 1) return send(200, []);
    // Las listas grandes tardan un poco, como en un panel real.
    const later = (body) => setTimeout(() => send(200, body), 400);
    switch (action) {
      case "get_live_categories":
        return later(liveCats);
      case "get_live_streams":
        return later(channels);
      case "get_short_epg": {
        const id = Number(url.searchParams.get("stream_id"));
        return send(200, id % 5 === 0 ? epgFor(id) : { epg_listings: [] });
      }
      case "get_vod_categories":
        return later(vodCats);
      case "get_vod_streams":
        return later(movies);
      case "get_series_categories":
        return later(vodCats);
      case "get_series":
        return later(shows);
      case "get_vod_info":
        return later(vodInfo(Number(url.searchParams.get("vod_id"))));
      case "get_series_info":
        return later(seriesInfo(Number(url.searchParams.get("series_id"))));
      default:
        return send(200, {});
    }
  }

  let m = /^\/logo\/(\d+)\.svg$/.exec(p);
  if (m) return send(200, svg(`CH ${Number(m[1]) - 1000}`, 220, 140, Number(m[1]) % 360), "image/svg+xml");
  m = /^\/backdrop\/([ms]\d+)\.svg$/.exec(p);
  if (m) return send(200, svg(`Fondo ${m[1]}`, 1280, 720, (parseInt(m[1].slice(1), 10) * 53) % 360), "image/svg+xml");
  m = /^\/thumb\/([\d-]+)\.svg$/.exec(p);
  if (m) return send(200, svg(`T${m[1].split("-")[1]} E${m[1].split("-")[2]}`, 640, 360, (parseInt(m[1], 10) * 29) % 360), "image/svg+xml");
  m = /^\/poster\/(s?\d+)\.svg$/.exec(p);
  if (m) return send(200, svg(m[1], 300, 450, (parseInt(m[1].replace("s", ""), 10) * 37) % 360), "image/svg+xml");

  const redirect = (to) => {
    res.writeHead(302, { Location: to });
    res.end();
  };

  m = /^\/live\/[^/]+\/[^/]+\/(\d+)\.(m3u8|ts)$/.exec(p);
  if (m) {
    // Cada 7.º canal falla a propósito (para ver el error y el reintento).
    if (Number(m[1]) % 7 === 0) return send(404, "not found", "text/plain");
    if (!HAS_MEDIA) return m[2] === "ts" ? send(404, "not found", "text/plain") : redirect(PUBLIC_STREAM);
    // Los paneles reales suelen redirigir a un balanceador.
    return redirect(m[2] === "ts" ? "/stream/live.ts" : "/stream/live.m3u8");
  }
  m = /^\/(movie|series)\/[^/]+\/[^/]+\/(\d+)\.(\w+)$/.exec(p);
  if (m) return redirect(HAS_MEDIA ? "/stream/vod.mp4" : PUBLIC_STREAM);

  if (HAS_MEDIA) {
    if (p === "/stream/live.m3u8") return send(200, livePlaylist(), "application/vnd.apple.mpegurl");
    if (p === "/stream/live.ts") return liveTs(req, res);
    if (p === "/stream/vod.mp4") return sendFile(req, res, join(MEDIA, "vod.mp4"), "video/mp4");
    m = /^\/stream\/seg\/(\d+)\.ts$/.exec(p);
    if (m) return sendFile(req, res, segFile(Number(m[1]) % SEGS), "video/mp2t");
  }
  send(404, "not found", "text/plain");
}).listen(PORT, "127.0.0.1", () => console.log(`Panel falso en http://127.0.0.1:${PORT} (demo / demo)`));
