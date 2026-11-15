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
node scripts/tv-login.mjs <port>              # types user/password into the app on the TV (port from tv:inspect)
```

- Logging in on the TV from the PC: run `npm run tv:inspect` in another terminal, take the port from the `http://localhost:<port>/devtools/...` URL it prints, then run `node scripts/tv-login.mjs <port>`. It asks for the credentials and never stores them. The same inspector port speaks CDP, so a small script can read the console, take screenshots (`Page.captureScreenshot`) and send keys (`Input.dispatchKeyEvent`). There's no such script in the repo yet: write one in the scratchpad if needed.

- Smoke test against dev: run `fake-panel`, then `VITE_PANEL_URL=http://127.0.0.1:8899 npx vite --port 5174`, then `node scripts/smoke.mjs http://127.0.0.1:5174 <dir>`. Use a port other than 5173: the user often has their own `npm run dev` there against the real panel. Never kill it.
- The smoke test checks text with `innerText`: rows further down aren't in the DOM yet (virtualization), and hidden controls (`visibility: hidden`) don't count. Navigate to a row before checking it.
- Smoke test against the TV build: `VITE_PANEL_URL=http://127.0.0.1:8899 npm run build`, then `node scripts/smoke.mjs file:///C:/Users/TEO/Downloads/iptv-webos/dist/index.html <dir>`. **Rebuild without that variable afterwards**: otherwise `dist/` points to the fake panel.
- The fake panel generates its test video with ffmpeg on first run (`node_modules/.cache/fake-panel`): a live HLS that advances with the clock, a continuous `.ts`, and an MP4 with Range. Stream id % 7 == 0 fails on purpose (channel 1 included). Public test streams are not used (one we relied on broke).
- Use headless Chrome via `playwright-core` with the installed Chrome. Never test playback in a hidden tab (no `sourceopen`).

## Per-install config

`.env.local` (out of git; see `.env.example`): `VITE_PANEL_URL`, `VITE_PANEL_LOCK`, `VITE_BRAND_NAME`, `VITE_BRAND_COLOR`, `APP_ID`, `APP_VENDOR`, `APP_VERSION`, `WEBOS_DEVICE`. One build per reseller. Optional icons in `brand/icon.png` (80×80) and `brand/largeIcon.png` (130×130).

**Brand: "Lytra TV"** (chosen 2026-11-15, the same for the TV, the web and Android). It comes from the owner's Lytra tracker (`C:\Users\TEO\Desktop\lytra-2`, `packages/theme/brand/`). The mark is Lytra's "Sequence" (three 5:7 cards in cascade, at 40/70/100 % opacity) with a play cut out of the front card. The wordmark is "lytr" in Geist Semibold plus Lytra's drawn "a" (ring and stem), with the rest of the name as a violet tag ("TV"). Both live in `ui/Brand.tsx`, drawn in the brand color. A name that doesn't start with "Lytra" (a reseller's) is written as plain text. Without `brand/*.png`, `scripts/appinfo.mjs` draws the icons: the same mark on Lytra's night tile. If the mark changes, change both places.

## Chromium 53 rules (enforced by `scripts/check-compat.mjs`)

- **CSS:** no Grid, no `gap` on flex (use `> * + *` margins), no `position: sticky`, `aspect-ratio`, `color-mix`, `oklch`, `inset`. The brand color variants are computed in JS (`src/brand.ts`) and set as CSS variables. Never write the brand color as a hex literal in a component's CSS.
- **JS:** build target `chrome53`, single classic IIFE script with `defer` (no ES modules: they don't work in Chromium 53 or under `file://`). Output must pass `es-check es2016`. Library gaps are polyfilled in `src/polyfills.ts` (core-js, per feature). No `ResizeObserver`, `AbortController` (the API uses XHR with timeout/abort), `focus({preventScroll})`, or `loading="lazy"`.
- No cookies in packaged apps: session and caches live in `localStorage` / IndexedDB.

## Architecture

- `src/data/`: `xtream.ts` (XHR client, tolerant field parsing, `streamUrl`, errors that never include the URL, since it carries credentials), `session.ts` (several accounts in localStorage, each with an optional name, like Android: `login` adds or updates one and makes it active, plus `switchTo`, `rename`, and `logout`, which removes the active one and moves to the next. Login codes are `invalid`/`expired`/`disabled`/`unreachable`, like the web), `catalog.ts` (memo + compact IndexedDB copy, refreshed in background after 6 h), `prefs.ts` (live engine HLS/TS, audio and subtitle language).
- `src/nav/`: remote-control navigation. Focusables carry `data-nav` (always `<button>`/`<input>`, so OK = click). Layers are `data-nav-layer`; only the last one in the document is active. Zones (`data-nav-zone`) remember their last focus. `VirtualList` handles up/down by index and lets the key through at the edges. Components that handle arrows call `preventDefault()`; the global `window` handler respects it.
  - **A new layer must take focus when it mounts** (`focusInitial(ref.current)` in a layout effect, as `Dialog`, `Login` and `LiveFullscreen` do). Otherwise focus stays in the list behind it, and that list swallows the arrows.
  - Back key (461 / Escape / Backspace): `useBack` handlers, the innermost one wins. Fallback: content → sidebar → "¿Salir?" dialog.
- `src/player/player.ts`: **one persistent `<video>`** (the TV has a single hardware decoder), drawn over the preview slot or full screen via `playerFrame`, never remounted. Sources are tried in order (HLS, then TS; the user's choice goes first and is remembered). Stopping does `removeAttribute("src")` + `load()` to free the decoder. The stall timer reloads only if `currentTime` stopped advancing (`stalled` fires during normal playback). Audio/subtitle preferences are applied once per load (first `playing`, or when tracks show up), not on every `playing`; without a saved audio language it prefers `es`. Languages are compared with `langKey()` (`spa` = `es`).
- **Embedded subtitles on the TV (`player/webosMedia.ts`):** the TV's Chromium leaves `video.textTracks` empty for subtitles inside MP4/MKV, but the TV's own player has them. For movies/episodes, `load()` polls `video.mediaId` (it reads `"<invalid mediaId>"` for the first ~40 ms after `loadstart`) and, as soon as it's valid, subscribes to `luna://com.webos.media/subscribe`. The one-time `sourceInfo` message (it comes before `loadedmetadata`; subscribing later never gets it) lists the tracks in `programInfo[0].subtitleTrackInfo`, then the subscription is cancelled. Showing one = `selectTrack {type:"text", index}` + `setSubtitleEnable {enable:true}`, re-sent after each `seeked`. `selectTrack` answers `returnValue: true` even for indexes that don't exist, so it can't be used to count tracks. Tracks without a language ("(null)") are shown as "Pista N" and remembered as `"on"`. Calls to `PalmServiceBridge` can't be watched by patching its prototype (`call` is an own property); wrap the constructor instead. The technique comes from Lampa (`yumata/lampa-source`, `src/interaction/player/video/webos/parser.js`). If subtitles ever stop showing on screen, try Lampa's order: `setSubtitleEnable` first, then `selectTrack` 500 ms later. Test case: "RUST" (MP4, stream id 390644), where the TV sees 1 text track without a language (Android shows 2).
- `src/screens/live/`: three columns (folders | channels | preview + now/next). OK plays in the preview, OK again goes full screen. CH± zap within the folder; the arrows only bring up the options bar (the user asked for that: they navigate with the D-pad). Digits jump to a channel number. A "Favoritos" folder appears when there are favorite channels (toggled from the full-screen bar).
- `src/screens/router.ts`: the current `section` (Inicio is the default) and a stack of `overlays` above it (movie/series detail, VOD player). Switching accounts resets both. Renaming the active account replaces the `session` object without changing the account, so anything that resets on account change compares `accountKey`, as `router.ts` and `catalog.ts` do. `addingAccount` shows the login (with a name field and Cancelar) in place of the app. Covered layers and the covered section stay mounted with `display: none`, so going Back returns to the same card. `watchChannel(id)` jumps from Inicio to Live full screen via `liveIntent`.
- **Netflix-style screens** (Inicio, Películas, Series, series detail) use `nav/Browse.tsx`: a hero header plus horizontal rows, virtualized on both axes, arrows handled by index (each row remembers its column), and movement by `transform` (it cancels the scroll that `focus()` causes). The page only moves up when the focused row doesn't fit. Card sizes live in `ui/Card.tsx` (`CARD_WIDTH`/`CARD_HEIGHT`) and must match `Card.module.css`. `nav/VirtualGrid.tsx` shows a full category.
- `src/player/VodPlayer.tsx`: movies and episodes on the shared `<video>`. ←/→ seek 10 s, accelerating while held (presses are batched and committed after 700 ms), OK pauses, the media keys always work, and Back hides the controls and then exits. It plays the next episode with a 10-second countdown. Progress is saved every 10 s and on exit (`data/progress.ts`: same rules as Android, at least 15 s, watched at 95 % or within 90 s of the end).
- `src/data/library.ts`: favorites (live/movie/series) and the last channels watched, per account in localStorage.
- **Give `key`s to siblings that appear or disappear next to focused content.** Unkeyed Preact children get reused and moved when a conditional sibling appears (e.g. the backdrop arriving with the movie info), and the focused button briefly leaves the DOM, so focus is lost. Hero, details, VodPlayer and LiveFullscreen already do this.
- Images: `lib/images.ts` rewrites TMDB URLs to small sizes (`w185` card posters, `w342` detail posters, `w1280` backdrops), because the TV decodes every image in memory. Many panels also send non-TMDB posters at 600×900 or even 1920×1080; those can't be resized without a server.

## Performance on the TV (measured 2026-11-14)

Measure on the real TV, not on the PC: through `ares-inspect` + CDP, record rAF frame times and key → paint latency while sending keys with `Input.dispatchKeyEvent`, and record `Tracing` / `Profiler` (Chromium 53: `awaitPromise` isn't supported, and profile times are in seconds). Things learned:
- In the rows, the cost is **decoding posters** on the raster threads. The JS (Preact) was ~60 ms per key. A new row with `w342` posters took ~0.4–0.9 s to show. So keep posters small and `OVERSCAN` low in `Browse.tsx`.
- **Don't animate a blurred `box-shadow`**: it repaints every frame. Card frames have `will-change: transform` (each one on its own layer, so the focus scale is composited); the shadow changes instantly. This took rows from ~39 to ~53 fps. Promoting only the focused card was worse.
- **Never sort the whole catalog** (16k movies) to build a row: `newest`/`topRated` use a top-N pass (`lib/collections.ts`; sorting took 200–300 ms on the TV, now ~15 ms). Keep those lists in a `useMemo` on the catalog only, because the rows rebuild every time video progress is saved (every 10 s while something plays).
- Create `Intl` formatters once (`lib/format.ts`). `toLocaleString()` builds a new one on every call.
- The first time a section opens there's still a ~0.85 s freeze, mostly the TV laying out and painting the new screen (JS is ~0.3 s of it). The channel list in En vivo is fine (~40 ms per key).
- `devicePixelRatio` reads 2, but the UI is laid out and drawn at 1920×1080 (`-webkit-min-device-pixel-ratio: 2` is false).

## Status (2026-11-14)

- **Phase 1 done on the PC:** scaffolding, build/package, navigation, login, live TV.
- **Phase 2 done on the PC** (redesigned with the user, Netflix style like the web): Inicio (hero + Seguir viendo, Canales favoritos, Vistos recientemente, Películas/Series recientes, Mi lista, Mejor valoradas), Películas and Series (hero, Recientes, Mi lista, one row per category + "Ver todas" grid, Categorías picker), movie and series details (continue, from the start, my list, seasons and episodes), VOD player (seek, pause, audio/subtitle pickers when the TV exposes tracks, next episode). The smoke test passes 43/43 in dev and on the `file://` build.
- **Tested on the TV** (webOS 4.5, Developer Mode): login/CORS, real catalog, live TV, `audioTracks` (2 tracks in a dual MP4), and embedded subtitles through `com.webos.media` (2026-11-14, "RUST" MP4). Navigation smoothness was measured and improved (see "Performance on the TV").
- **Next: test on the TV** (in this order):
  1. Movies and episodes in **MKV**: AC-3/E-AC-3/DTS audio, audio track picker, embedded subtitles.
  2. The **TS** engine in live (only HLS has been tried on the TV).
  3. **Automatic next episode** at the end of one (the countdown).
  4. **Exiting the app** ("¿Salir?" dialog, then back to the TV) and coming back.
  5. **Stability** after an hour of playback (the TV shouldn't slow down).
- **Multi-account UI done** (2026-11-15): Cuenta lists the accounts on the TV (OK switches, Renombrar, Agregar cuenta), tested on the TV. The owner's account there is named "teo".
- **Phase 3 pending** (after those tests): Search (placeholder in `screens/Soon.tsx`), "Sin audio" notice, README.
