import { defineConfig, type Plugin } from "vite";

/**
 * El navegador de webOS 4.x (Chromium 53) no entiende `<script type="module">`, y bajo `file://`
 * el atributo `crossorigin` bloquea la carga de scripts y estilos. El build deja un único script
 * clásico (IIFE) con `defer`.
 */
function classicScripts(): Plugin {
  return {
    name: "iptv:classic-scripts",
    apply: "build",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html.replace(/<script type="module"/g, "<script defer").replace(/ crossorigin(="[^"]*")?/g, "");
      },
    },
  };
}

export default defineConfig({
  base: "./",
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  plugins: [classicScripts()],
  build: {
    // webOS TV 4.x (2018–2019). Todo lo que esbuild no sabe bajar a esta versión lo vigila scripts/check-compat.mjs.
    target: "chrome53",
    cssTarget: "chrome53",
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
