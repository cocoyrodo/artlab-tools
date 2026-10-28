// Extrae todos los textos que pasan por t(), los textos fijos marcados con
// data-i18n y las listas que se traducen al mostrarse (categorías, modalidades…).
import { readFileSync } from "node:fs";

const ARCHIVOS = ["assets/i18n.js", "assets/monedas.js", "assets/conversion.js", "assets/auth.js", "assets/shell.js", "index.html", "finanzas/app.js", "finanzas/index.html", "perfil/app.js", "contenido/app.js", "auditoria/app.js"];
const BLOQUES = [/const CATEGORIAS = \{[\s\S]*?\n\};/, /const MODALIDADES = \{[\s\S]*?\n\};/, /const TITULOS = \{[^}]*\};/, /export const TOOLS = \[[\s\S]*?\n\];/,
  /const TONOS = \[[^\]]*\];/, /const TIPOS = \{[^}]*\};/, /const PESTANAS = \{[^}]*\};/, /const PEDIDOS = \{[\s\S]*?\n\};/, /const ERRORES = \{[\s\S]*?\n\};/,
  /const PASOS = \[[^\]]*\];/, /const PRIORIDADES = \{[^}]*\};/, /const ESTADOS = \{[^}]*\};/];

export function clavesUsadas(base = new URL("..", import.meta.url)) {
  const claves = new Set();
  for (const f of ARCHIVOS) {
    const src = readFileSync(new URL(f, base), "utf8");
    for (const m of src.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) claves.add(JSON.parse(`"${m[1]}"`));
    for (const m of src.matchAll(/data-i18n(?:-ph|-aria)?="([^"]+)"/g)) claves.add(m[1]);
    for (const m of src.matchAll(/data-i18n>([^<]+)</g)) claves.add(m[1].trim());
    for (const re of BLOQUES) {
      const b = src.match(re);
      if (!b) continue;
      for (const m of b[0].matchAll(/(?:nombre|detalle|venta|costo|gasto|independiente|comision|arriendo|otro)?:?\s*"([^"]+)"/g)) {
        if (!/^\/|^[a-z]+$/.test(m[1]) || ["venta", "gasto"].includes(m[1])) claves.add(m[1]);
      }
    }
  }
  // Textos que llegan a t() dentro de una expresión
  ["Sin definir"].forEach((k) => claves.add(k));
  // Valores fijos que no son textos visibles (rutas, ids, coordenadas de íconos SVG)
  ["/finanzas/", "/contenido/", "/auditoria/", "finanzas", "calculadora", "organizador", "contenido"].forEach((k) => claves.delete(k));
  for (const k of [...claves]) if (/^[\d. ]+$|^M[\d.]/.test(k)) claves.delete(k);
  return [...claves].sort((a, b) => a.localeCompare(b, "es"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  console.log(JSON.stringify(clavesUsadas(), null, 1));
}
