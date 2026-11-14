# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

A packaged **LG webOS TV app** for an IPTV service that speaks the Xtream Codes API (`player_api.php`). Sibling projects: `../iptv-web/iptv-web` (Next.js, video proxied through the server) and `../iptv-android` (native, talks to the panel directly). Like Android, **this app talks to the panel directly** (no proxy): the panel answers CORS with the same `Origin` it receives, including `null` (the origin of a `file://` app).

Target: the owner's **LG UM7500PSB = webOS TV 4.5 = Chromium 53**. Everything must run there. UI text and code comments are in Spanish (dates `es-CL`).

The full plan (phases, decisions, TV checklist) is in `C:\Users\TEO\.claude\plans\breezy-painting-rossum.md`.

## Commands

```bash
npm run dev          # Vite on 127.0.0.1:5173 (hls.js is loaded only in dev, for desktop Chrome)
npm run build        # tsc + vite build + scripts/appinfo.mjs + scripts/check-compat.mjs → dist/
npm run package      # build + ares-package → out/<id>_<version>_all.ipk
npm run tv:install | tv:launch | tv:inspect   # ares-* against WEBOS_DEVICE (default "tv")
npm run fake-panel   # fake Xtream panel on 127.0.0.1:8899 (demo/demo; vencido/demo = expired)
node scripts/smoke.mjs <url> <shots-dir>      # keyboard-only smoke test, exits 1 on failure
```

- Smoke test against dev: run `fake-panel`, then `VITE_PANEL_URL=http://127.0.0.1:8899 npx vite --port 5174`, then `node scripts/smoke.mjs http://127.0.0.1:5174 <dir>`. Use a port other than 5173: the user often has their own `npm run dev` there against the real panel. Never kill it.
- The smoke test checks text with `innerText`: rows further down aren't in the DOM yet (virtualization), and hidden controls (`visibility: hidden`) don't count. Navigate to a row before checking it.
- Smoke test against the TV build: `VITE_PANEL_URL=http://127.0.0.1:8899 npm run build`, then `node scripts/smoke.mjs file:///C:/Users/TEO/Downloads/iptv-webos/dist/index.html <dir>`. **Rebuild without that variable afterwards**: otherwise `dist/` points to the fake panel.
- The fake panel generates its test video with ffmpeg on first run (`node_modules/.cache/fake-panel`): a live HLS that advances with the clock, a continuous `.ts`, and an MP4 with Range. Stream id % 7 == 0 fails on purpose (channel 1 included). Public test streams are not used (one we relied on broke).
- Use headless Chrome via `playwright-core` with the installed Chrome. Never test playback in a hidden tab (no `sourceopen`).

## Per-install config

`.env.local` (out of git; see `.env.example`): `VITE_PANEL_URL`, `VITE_PANEL_LOCK`, `VITE_BRAND_NAME`, `VITE_BRAND_COLOR`, `APP_ID`, `APP_VENDOR`, `APP_VERSION`, `WEBOS_DEVICE`. One build per reseller. Optional icons in `brand/icon.png` (80×80) and `brand/largeIcon.png` (130×130).

## Chromium 53 rules (enforced by `scripts/check-compat.mjs`)

- **CSS:** no Grid, no `gap` on flex (use `> * + *` margins), no `position: sticky`, `aspect-ratio`, `color-mix`, `oklch`, `inset`. The brand color variants are computed in JS (`src/brand.ts`) and set as CSS variables. Never write the brand color as a hex literal in a component's CSS.
- **JS:** build target `chrome53`, single classic IIFE script with `defer` (no ES modules: they don't work in Chromium 53 or under `file://`). Output must pass `es-check es2016`. Library gaps are polyfilled in `src/polyfills.ts` (core-js, per feature). No `ResizeObserver`, `AbortController` (the API uses XHR with timeout/abort), `focus({preventScroll})`, or `loading="lazy"`.
- No cookies in packaged apps: session and caches live in `localStorage` / IndexedDB.

## Architecture

- `src/data/`: `xtream.ts` (XHR client, tolerant field parsing, `streamUrl`, errors that never include the URL, since it carries credentials), `session.ts` (accounts in localStorage, login codes `invalid`/`expired`/`disabled`/`unreachable` like the web), `catalog.ts` (memo + compact IndexedDB copy, refreshed in background after 6 h), `prefs.ts` (live engine HLS/TS, audio language).
- `src/nav/`: remote-control navigation. Focusables carry `data-nav` (always `<button>`/`<input>`, so OK = click). Layers are `data-nav-layer`; only the last one in the document is active. Zones (`data-nav-zone`) remember their last focus. `VirtualList` handles up/down by index and lets the key through at the edges. Components that handle arrows call `preventDefault()`; the global `window` handler respects it.
  - **A new layer must take focus when it mounts** (`focusInitial(ref.current)` in a layout effect, as `Dialog`, `Login` and `LiveFullscreen` do). Otherwise focus stays in the list behind it, and that list swallows the arrows.
  - Back key (461 / Escape / Backspace): `useBack` handlers, the innermost one wins. Fallback: content → sidebar → "¿Salir?" dialog.
- `src/player/player.ts`: **one persistent `<video>`** (the TV has a single hardware decoder), drawn over the preview slot or full screen via `playerFrame`, never remounted. Sources are tried in order (HLS, then TS; the user's choice goes first and is remembered). Stopping does `removeAttribute("src")` + `load()` to free the decoder. The stall timer reloads only if `currentTime` stopped advancing (`stalled` fires during normal playback).
- `src/screens/live/`: three columns (folders | channels | preview + now/next). OK plays in the preview, OK again goes full screen. CH± zap within the folder; the arrows only bring up the options bar (the user asked for that: they navigate with the D-pad). Digits jump to a channel number. A "Favoritos" folder appears when there are favorite channels (toggled from the full-screen bar).
- `src/screens/router.ts`: the current `section` (Inicio is the default) and a stack of `overlays` above it (movie/series detail, VOD player). Covered layers and the covered section stay mounted with `display: none`, so going Back returns to the same card. `watchChannel(id)` jumps from Inicio to Live full screen via `liveIntent`.
- **Netflix-style screens** (Inicio, Películas, Series, series detail) use `nav/Browse.tsx`: a hero header plus horizontal rows, virtualized on both axes, arrows handled by index (each row remembers its column), and movement by `transform` (it cancels the scroll that `focus()` causes). The page only moves up when the focused row doesn't fit. Card sizes live in `ui/Card.tsx` (`CARD_WIDTH`/`CARD_HEIGHT`) and must match `Card.module.css`. `nav/VirtualGrid.tsx` shows a full category.
- `src/player/VodPlayer.tsx`: movies and episodes on the shared `<video>`. ←/→ seek 10 s, accelerating while held (presses are batched and committed after 700 ms), OK pauses, the media keys always work, and Back hides the controls and then exits. It plays the next episode with a 10-second countdown. Progress is saved every 10 s and on exit (`data/progress.ts`: same rules as Android, at least 15 s, watched at 95 % or within 90 s of the end).
- `src/data/library.ts`: favorites (live/movie/series) and the last channels watched, per account in localStorage.
- **Give `key`s to siblings that appear or disappear next to focused content.** Unkeyed Preact children get reused and moved when a conditional sibling appears (e.g. the backdrop arriving with the movie info), and the focused button briefly leaves the DOM, so focus is lost. Hero, details, VodPlayer and LiveFullscreen already do this.
- Images: `lib/images.ts` rewrites TMDB URLs to small sizes (`w342` posters, `w1280` backdrops), because the TV decodes every image in memory.

## Status (2026-11-14)

- **Phase 1 done on the PC:** scaffolding, build/package, navigation, login, live TV.
- **Phase 2 done on the PC** (redesigned with the user, Netflix style like the web): Inicio (hero + Seguir viendo, Canales favoritos, Vistos recientemente, Películas/Series recientes, Mi lista, Mejor valoradas), Películas and Series (hero, Recientes, Mi lista, one row per category + "Ver todas" grid, Categorías picker), movie and series details (continue, from the start, my list, seasons and episodes), VOD player (seek, pause, audio/subtitle pickers when the TV exposes tracks, next episode). The smoke test passes 43/43 in dev and on the `file://` build.
- **Not tested on the TV yet** (needs Developer Mode, see the plan): CORS, performance with the real catalog, AC-3/DTS, `audioTracks`/`textTracks`.
- **Phase 3 pending:** Search (placeholder in `screens/Soon.tsx`), multi-account UI, "Sin audio" notice, README.
