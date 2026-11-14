/*
 * Lo que falta en Chromium 53 (webOS TV 4.x) de lo que usa la app.
 * La sintaxis moderna (async/await, spread, `?.`, `??`) la baja esbuild en el build; esto cubre
 * solo funciones de la biblioteca estándar. tsconfig limita los tipos a ES2019: si usas algo más
 * nuevo, agrégalo aquí.
 */
import "core-js/actual/object/entries";
import "core-js/actual/object/values";
import "core-js/actual/object/from-entries";
import "core-js/actual/string/pad-start";
import "core-js/actual/string/pad-end";
import "core-js/actual/string/trim-start";
import "core-js/actual/string/trim-end";
import "core-js/actual/promise/finally";
import "core-js/actual/array/flat";
import "core-js/actual/array/flat-map";
