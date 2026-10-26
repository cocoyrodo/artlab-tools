// Idiomas de ART LAB Tools: los mismos 6 de la App ART LAB, con la misma
// clave de preferencia (artlab_language). Las traducciones viven en
// i18n-dict.js (texto en español → traducción), así funcionan al instante
// y sin servicios externos. El español es el texto original del código.
import { DICT } from "/assets/i18n-dict.js?v=20261026g";

export const LANGS = [
  ["es", "Español"], ["en", "English"], ["fr", "Français"],
  ["it", "Italiano"], ["pt", "Português"], ["nl", "Nederlands"],
];
const CODES = LANGS.map(([c]) => c);
const LOCALES = { es: "es-CL", en: "en-US", fr: "fr-FR", it: "it-IT", pt: "pt-BR", nl: "nl-NL" };
const KEY = "artlab_language";

function inicial() {
  try {
    const guardado = localStorage.getItem(KEY);
    if (CODES.includes(guardado)) return guardado;
  } catch { /* sin almacenamiento: se usa el idioma del dispositivo */ }
  const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
  return CODES.includes(nav) ? nav : "es";
}

export let lang = inicial();
document.documentElement.lang = lang;

export const locale = () => LOCALES[lang];

// t('Hola, {nombre}', { nombre }): los valores deben venir ya escapados si van a HTML
export function t(es, vars) {
  const fila = DICT[es];
  let txt = lang === "es" || !fila ? es : (fila[CODES.indexOf(lang) - 1] || es);
  if (vars) txt = txt.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return txt;
}

// Nombre del país en el idioma actual (el país se guarda en español)
export function nombrePais(iso, fallback) {
  try { return iso ? new Intl.DisplayNames([locale()], { type: "region" }).of(iso) : fallback; }
  catch { return fallback; }
}

// Guarda la elección y recarga para pintar todo en el nuevo idioma
export function setLang(nuevo, { recargar = true } = {}) {
  if (!CODES.includes(nuevo)) return;
  try { localStorage.setItem(KEY, nuevo); } catch { /* sin almacenamiento */ }
  lang = nuevo;
  document.documentElement.lang = nuevo;
  if (recargar) location.reload();
}

// Si este dispositivo aún no eligió idioma, usa el de la cuenta (como la App)
export function aplicarIdiomaCuenta(session) {
  const deCuenta = session?.user?.user_metadata?.lang;
  if (!CODES.includes(deCuenta) || deCuenta === lang) return false;
  try { if (localStorage.getItem(KEY)) return false; } catch { return false; }
  setLang(deCuenta);
  return true;
}

// Textos fijos del HTML: data-i18n (texto), data-i18n-ph (placeholder), data-i18n-aria
export function traducirEstaticos(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n || el.textContent.trim()); });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
}

// Selector de idioma igual al de la App ART LAB
export function selectorIdioma() {
  return `<div class="lang-switcher" translate="no">
    <button type="button" class="lang-current" aria-label="${t("Seleccionar idioma")}"><span class="lang-current-code">${lang.toUpperCase()}</span><span class="lang-arrow">▼</span></button>
    <div class="lang-menu">${LANGS.map(([c, n]) => `<button type="button" data-lang="${c}"><strong>${c.toUpperCase()}</strong><span>${n}</span></button>`).join("")}</div>
  </div>`;
}

export function activarSelector(root, alCambiar) {
  root.querySelectorAll(".lang-switcher").forEach((sw) => {
    sw.querySelector(".lang-current").onclick = (e) => { e.stopPropagation(); sw.classList.toggle("open"); };
    sw.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation();
      sw.classList.remove("open");
      if (b.dataset.lang === lang) return;
      await alCambiar?.(b.dataset.lang);
      setLang(b.dataset.lang);
    }));
  });
  document.addEventListener("click", () => root.querySelectorAll(".lang-switcher.open").forEach((sw) => sw.classList.remove("open")));
}
