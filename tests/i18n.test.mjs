// Cada texto visible debe tener sus 5 traducciones, con las mismas variables
// {x} y etiquetas <em> que el original, y sin palabras prohibidas por marca.
import assert from "node:assert/strict";
import { clavesUsadas } from "./i18n-keys.mjs";
import { DICT } from "../assets/i18n-dict.js";

const claves = clavesUsadas();
const faltan = claves.filter((k) => !DICT[k]);
assert.deepEqual(faltan, [], "Textos sin traducción: " + JSON.stringify(faltan, null, 1));

const PROHIBIDAS = /\b(gratis|gratuit\w*|free|regalo|cadeau)\b/i;
const marcas = (s) => [...s.matchAll(/\{\w+\}|<\/?em>/g)].map((m) => m[0]).sort().join(" ");
for (const [es, fila] of Object.entries(DICT)) {
  assert.equal(fila.length, 5, `«${es}» debe tener 5 traducciones (en, fr, it, pt, nl)`);
  for (const tr of fila) {
    assert.ok(tr && tr.trim(), `«${es}» tiene una traducción vacía`);
    assert.equal(marcas(tr), marcas(es), `«${es}» → «${tr}» no conserva {variables} o <em>`);
    assert.ok(!PROHIBIDAS.test(tr), `«${tr}» usa una palabra prohibida`);
  }
}
const sobran = Object.keys(DICT).filter((k) => !claves.includes(k));
if (sobran.length) console.log("Aviso: traducciones que ya no se usan:", sobran);
console.log(`OK: ${claves.length} textos traducidos a 5 idiomas`);
