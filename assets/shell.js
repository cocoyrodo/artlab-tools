// Estructura común de ART LAB Tools, igual a la App ART LAB:
// logo arriba, contenido al centro y barra de navegación flotante abajo.
import { supabase, esc } from "/assets/auth.js?v=20261026d";

export const ICONS = {
  inicio: `<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>`,
  finanzas: `<svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 5-6"/></svg>`,
  organizador: `<svg viewBox="0 0 24 24"><path d="M4 5h16v15H4z"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="M8 13l2 2 5-5"/></svg>`,
  calculadora: `<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h4"/></svg>`,
  contenido: `<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M11 14l3-2-3-2z"/><path d="M10 18h4"/></svg>`,
  cuenta: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>`,
};

export const TOOLS = [
  { id: "finanzas", nombre: "Finanzas", detalle: "Ventas, gastos y ganancias", href: "/finanzas/", activa: true },
  { id: "calculadora", nombre: "Calculadora", detalle: "Precio de tus servicios" },
  { id: "organizador", nombre: "Organizador", detalle: "Agenda y clientas" },
  { id: "contenido", nombre: "Contenido", detalle: "Planifica tus Reels" },
];

const iniciales = (session) => {
  const n = session?.user?.user_metadata?.nombre || session?.user?.email || "";
  return n.trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "TÚ";
};

// Pinta la estructura y devuelve el elemento donde va el contenido de la página.
export function renderShell(root, { active, session }) {
  root.innerHTML = `
    <div class="aa">
      <div class="top">
        <a class="brand" href="/"><img class="brand-logo" src="/assets/brand/logo-pink-black.webp" alt="Cocó & Rodo — ART LAB"></a>
        ${session
          ? `<button type="button" class="profile" id="profileBtn" aria-label="Mi cuenta">${esc(iniciales(session))}</button>`
          : `<a class="profile" href="/finanzas/">Entrar</a>`}
      </div>
      <main id="view"></main>
    </div>
    <nav class="bottom" aria-label="Herramientas">
      <a class="bn ${active === "inicio" ? "on" : ""}" href="/">${ICONS.inicio}<span>Inicio</span></a>
      <a class="bn ${active === "finanzas" ? "on" : ""}" href="/finanzas/">${ICONS.finanzas}<span>Finanzas</span></a>
      <span class="bn soon" aria-disabled="true">${ICONS.calculadora}<span>Pronto</span></span>
      ${session
        ? `<button type="button" class="bn" id="logoutBtn">${ICONS.cuenta}<span>Salir</span></button>`
        : `<a class="bn" href="/finanzas/">${ICONS.cuenta}<span>Entrar</span></a>`}
    </nav>`;

  const salir = async () => {
    if (!confirm("¿Cerrar sesión?")) return;
    await supabase.auth.signOut();
    location.href = "/";
  };
  root.querySelector("#profileBtn")?.addEventListener("click", salir);
  root.querySelector("#logoutBtn")?.addEventListener("click", salir);
  return root.querySelector("#view");
}
