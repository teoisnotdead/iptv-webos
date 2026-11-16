# Lytra TV para LG webOS

App para Smart TV LG (webOS) de un servicio IPTV compatible con la API de Xtream Codes (`player_api.php`). Se maneja entera con el control remoto y habla directo con el panel, sin servidor intermedio. El video lo reproduce el propio TV, así que funcionan AC-3/E-AC-3 y, en MKV, DTS.

Pensada para **webOS 4.x (Chromium 53)** en adelante: el build se compila para ese navegador y un chequeo automático rechaza lo que no entiende. Probada en un LG UM7500PSB (webOS 4.5).

## Funciones

- **Inicio** estilo Netflix: película destacada, Seguir viendo, canales favoritos y vistos recientemente, películas y series recientes, Mi lista y mejor valoradas.
- **TV en vivo** en tres columnas (carpetas, canales y vista previa con guía). OK reproduce en la vista previa; OK otra vez, a pantalla completa.
  - En pantalla completa, CH± cambia de canal dentro de la carpeta y las flechas muestran la barra de opciones. Los dígitos saltan a un número de canal.
  - HLS o MPEG-TS: se elige en la barra, se recuerda, y si un formato falla se prueba el otro solo.
  - Carpeta **Favoritos** con los canales marcados desde la pantalla completa.
- **Películas y series**: una fila por categoría, la categoría completa en grilla y selector de categorías.
  - Fichas con Continuar, Desde el inicio y Mi lista.
  - Temporadas y episodios, con lo visto marcado.
- **Reproductor**:
  - Adelantar y retroceder con ←/→ (más rápido si se mantiene); OK pausa y funcionan las teclas de reproducción del control.
  - Elegir pista de audio y subtítulos. En el TV también se ven los subtítulos que vienen dentro del MP4/MKV (se piden al reproductor de webOS).
  - Siguiente episodio automático, con cuenta regresiva.
  - Recuerda dónde quedaste.
- **Varias cuentas** del panel en el mismo TV (pantalla Cuenta): cambiar de una a otra, ponerles nombre, agregar y cerrar sesión.
- Favoritos, avance y canales recientes se guardan **solo en el TV**, por cuenta.
- Pendiente: **Buscar** (el botón ya está en el menú).

## Requisitos

- **Node.js 20.19 o más nuevo** (lo pide Vite 7).
- Para la prueba de humo: Google Chrome instalado. Si no está en la ruta por defecto de Windows, indícala en `CHROME_PATH`.
- Para el panel falso: `ffmpeg` en el PATH (o en `FFMPEG`), que genera el video de prueba.

## Configuración

Cada instalación (o revendedor) tiene su propio build. Copia `.env.example` como `.env.local`, que no se sube a git, y completa:

| Variable | Para qué |
|---|---|
| `VITE_PANEL_URL` | Servidor por defecto en el login (URL base del panel, sin barra final) |
| `VITE_PANEL_LOCK` | `true`: el servidor queda fijo y no se muestra en el login |
| `VITE_BRAND_NAME`, `VITE_BRAND_COLOR` | Nombre y color de marca |
| `APP_ID`, `APP_VENDOR`, `APP_VERSION` | Identidad de la app en el TV |
| `WEBOS_DEVICE` | Nombre del TV configurado con `ares-setup-device` (por defecto `tv`) |

Si el nombre empieza con "Lytra", se dibuja el logo de Lytra TV en el color de marca; si no, el nombre va como texto. Íconos propios (opcional): `brand/icon.png` (80×80) y `brand/largeIcon.png` (130×130). Sin ellos, el build dibuja el ícono de Lytra TV.

## Comandos

```bash
npm install
npm run dev          # en el navegador, manejando la app con el teclado (flechas, Enter, Escape)
npm run build        # dist/ para el TV, con chequeo de tipos y de compatibilidad con Chromium 53
npm run package      # build + out/<id>_<versión>_all.ipk
npm run tv:install   # instala el .ipk en el TV
npm run tv:launch    # abre la app en el TV
npm run tv:inspect   # inspector web (consola, red) de la app en el TV
node scripts/tv-login.mjs <puerto>   # escribe usuario y contraseña en el login del TV (puerto del inspector)
```

En el PC, el teclado hace de control remoto: flechas, Enter (OK), Escape o Retroceso (Atrás), RePág/AvPág (CH±) y dígitos.

## Instalar en el TV

Las apps fuera de la tienda de LG se instalan con **Developer Mode**:

1. Crea una cuenta de desarrollador (gratis) en https://webostv.developer.lge.com.
2. En el TV instala **Developer Mode** desde LG Content Store, inicia sesión con esa cuenta y activa **Dev Mode Status** (el TV se reinicia). Después vuelve a abrir la app, activa **Key Server** y anota la IP y la passphrase.
3. Instala el `.ipk` desde un PC conectado a la **misma red** que el TV (por cable o Wi-Fi, da igual; no sirve la red de invitados). Hay dos formas:

   **Con este repo** (Node.js):

   ```bash
   npx ares-setup-device -a tv -i "host=<IP del TV>" -i "port=9922" -i "username=prisoner"
   npx ares-novacom --device tv --getkey   # pide la passphrase
   npm run package
   npm run tv:install
   npm run tv:launch
   ```

   **Sin programar**, con [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop/releases/latest) (Windows, Mac, Linux o Android): agrega el TV con la IP, el puerto `9922`, el usuario `prisoner` y la passphrase. Luego, en Apps → **Install**, elige el `.ipk` que te pasaron.

4. Abre la app en el TV y entra con el usuario y la contraseña del panel.

**La sesión de Developer Mode vence** (unas 1000 horas, ~41 días). Para que no venza, abre Developer Mode y presiona **EXTEND** una vez al mes, con el TV conectado a internet. Si vence, el TV borra las apps instaladas así y hay que activar el modo e instalar de nuevo. Después de instalar, Key Server se puede apagar.

Para que la vean tus clientes sin Developer Mode hay que publicarla en LG Content Store (cuenta de vendedor y revisión de LG).

## Probar sin un panel real

```bash
npm run fake-panel                                            # panel falso en 127.0.0.1:8899 (demo / demo)
VITE_PANEL_URL=http://127.0.0.1:8899 npx vite --port 5174
node scripts/smoke.mjs http://127.0.0.1:5174 capturas         # recorrido completo con el teclado
```

En PowerShell, la segunda línea es `$env:VITE_PANEL_URL="http://127.0.0.1:8899"; npx vite --port 5174`.

El panel falso tiene miles de canales, películas y series (usuario `vencido` / `demo` para probar una cuenta vencida). Genera su propio video de prueba con ffmpeg y algunos canales fallan a propósito. La prueba de humo usa `playwright-core` con el Chrome instalado y saca una captura por paso.

## Estructura

```
src/
  data/     cliente Xtream (XHR), sesión con varias cuentas, catálogo con copia en IndexedDB, favoritos, avance
  nav/      navegación con el control: foco espacial, Atrás, listas, filas y grillas virtualizadas
  player/   el <video> único, reproductor de películas y episodios, pistas y subtítulos de webOS
  screens/  Inicio, En vivo, Películas/Series, fichas, Cuenta, login
  ui/       componentes (tarjetas, portada, marca, botones, diálogos…), cada uno con su CSS Module
  lib/      utilidades: imágenes más chicas, armado de filas, formatos de fecha, estado compartido
scripts/    appinfo.json e íconos, chequeo de compatibilidad, CLI del TV, login remoto, panel falso, prueba de humo
```

## Licencias

Fuentes Geist, Geist Mono e Instrument Serif bajo SIL Open Font License (textos en `public/fonts/`).
