# IPTV para LG webOS

App para Smart TV LG (webOS) de un servicio IPTV compatible con la API de Xtream Codes (`player_api.php`). Se maneja entera con el control remoto y habla directo con el panel, sin servidor intermedio. El video lo reproduce el propio TV, así que funcionan AC-3/E-AC-3 y, en MKV, DTS.

Pensada para **webOS 4.x (Chromium 53)** en adelante: el build se compila para ese navegador y un chequeo automático rechaza lo que no entiende.

## Funciones

- **Inicio** estilo Netflix: película destacada, Seguir viendo, canales favoritos y vistos recientemente, películas y series recientes, Mi lista y mejor valoradas.
- **TV en vivo** en tres columnas (carpetas, canales y vista previa con guía).
  - Pantalla completa con zapping (↑/↓ o CH±) y número de canal con los dígitos.
  - HLS o MPEG-TS: se elige en la pantalla completa, se recuerda, y si un formato falla se prueba el otro solo.
  - Favoritos.
- **Películas y series**: una fila por categoría, la categoría completa en grilla y selector de categorías.
  - Fichas con Continuar, Desde el inicio y Mi lista.
  - Temporadas y episodios, con lo visto marcado.
- **Reproductor**:
  - Adelantar y retroceder con ←/→ (más rápido si se mantiene); funcionan las teclas de reproducción del control.
  - Pistas de audio y subtítulos si el TV las entrega.
  - Siguiente episodio automático.
  - Recuerda dónde quedaste.
- Favoritos, avance y canales recientes se guardan **solo en el TV**, por cuenta.

## Configuración

Cada instalación (o revendedor) tiene su propio build. Copia `.env.example` como `.env.local`, que no se sube a git, y completa:

| Variable | Para qué |
|---|---|
| `VITE_PANEL_URL` | Servidor por defecto en el login (URL base del panel, sin barra final) |
| `VITE_PANEL_LOCK` | `true`: el servidor queda fijo y no se muestra en el login |
| `VITE_BRAND_NAME`, `VITE_BRAND_COLOR` | Nombre y color de marca |
| `APP_ID`, `APP_VENDOR`, `APP_VERSION` | Identidad de la app en el TV |
| `WEBOS_DEVICE` | Nombre del TV configurado con `ares-setup-device` |

Íconos propios (opcional): `brand/icon.png` (80×80) y `brand/largeIcon.png` (130×130).

## Comandos

```bash
npm install
npm run dev          # en el navegador, manejando la app con el teclado (flechas, Enter, Escape)
npm run build        # dist/ para el TV, con chequeo de tipos y de compatibilidad con Chromium 53
npm run package      # build + out/<id>_<versión>_all.ipk
npm run tv:install   # instala el .ipk en el TV
npm run tv:launch    # abre la app en el TV
npm run tv:inspect   # inspector web (consola, red) de la app en el TV
```

En el PC, el teclado hace de control remoto: flechas, Enter (OK), Escape o Retroceso (Atrás), RePág/AvPág (CH±) y dígitos.

## Instalar en el TV

1. Crea una cuenta en https://webostv.developer.lge.com.
2. En el TV instala **Developer Mode** desde LG Content Store, inicia sesión y activa **Dev Mode Status** (el TV se reinicia). Después activa **Key Server** y anota la IP y la passphrase. La sesión de desarrollo vence; se renueva con **EXTEND**.
3. En el PC, con el TV y el PC en la misma red:

   ```bash
   npx ares-setup-device -a tv -i "host=<IP del TV>" -i "port=9922" -i "username=prisoner"
   npx ares-novacom --device tv --getkey   # pide la passphrase
   npm run package && npm run tv:install && npm run tv:launch
   ```

Para que la vean tus clientes hay que publicarla en LG Content Store (cuenta de vendedor y revisión de LG).

## Probar sin un panel real

```bash
npm run fake-panel                                            # panel falso en 127.0.0.1:8899 (demo / demo)
VITE_PANEL_URL=http://127.0.0.1:8899 npx vite --port 5174
node scripts/smoke.mjs http://127.0.0.1:5174 capturas         # recorrido completo con el teclado
```

El panel falso tiene miles de canales, películas y series. Genera su propio video de prueba con ffmpeg y algunos canales fallan a propósito. La prueba de humo usa `playwright-core` con el Chrome instalado y saca una captura por paso.

## Estructura

```
src/
  data/     cliente Xtream (XHR), sesión, catálogo con copia en IndexedDB, favoritos, avance
  nav/      navegación con el control: foco espacial, Atrás, listas, filas y grillas virtualizadas
  player/   el <video> único, reproductor de películas y episodios, pistas
  screens/  Inicio, En vivo, Películas/Series, fichas, Cuenta, login
  ui/       componentes (tarjetas, portada, botones, diálogos…), cada uno con su CSS Module
scripts/    appinfo.json, chequeo de compatibilidad, CLI del TV, panel falso, prueba de humo
```

## Licencias

Fuentes Geist, Geist Mono e Instrument Serif bajo SIL Open Font License (textos en `public/fonts/`).
