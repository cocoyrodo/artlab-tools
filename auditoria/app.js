import { supabase, esc } from "/assets/auth.js?v=20261028b";
import { renderShell } from "/assets/shell.js?v=20261028b";
import { t, lang, locale, alTraducir } from "/assets/i18n.js?v=20261028b";
import { AUDITORIA_URL } from "/assets/config.js?v=20261028b";

// Auditoría pública de Instagram (sin cuenta). La lectura del perfil la hace la
// Edge Function artlab-ig-audit del proyecto ART LAB, que tiene la conexión con Meta.
// Flujo: @ → análisis → gancho → correo → auditoría completa → la app.

const root = document.getElementById("root");
const qs = new URLSearchParams(location.search);
const utm = {};
["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"].forEach((k) => { if (qs.get(k)) utm[k] = qs.get(k).slice(0, 80); });

let vista = "inicio", handle = qs.get("u") || "", auditId = "", teaser = null, informe = null, error = "", puerta = false, enviando = false;
const PASOS = ["Leyendo tu perfil", "Revisando tus últimos 12 posts", "Buscando llamados a la acción", "Midiendo formato y constancia", "Preparando tus sugerencias"];
const ERRORES = {
  invalid_handle: "Revisa el usuario: solo letras, números, puntos y guiones bajos.",
  not_professional: "No pudimos leer esa cuenta. Funciona con cuentas profesionales (empresa o creadora): cámbiala en Instagram → Configuración → Tipo de cuenta. Revisa también que el usuario esté bien escrito.",
  rate_limited: "Hiciste varias auditorías seguidas. Espera un rato y vuelve a intentarlo.",
  busy: "Hay muchas auditorías en curso. Intenta de nuevo en unos minutos.",
  invalid_email: "Revisa tu correo.",
  consent_required: "Para mostrarte tu auditoría necesitamos que aceptes la política de privacidad.",
  audit_expired: "Esta auditoría venció. Vuelve a empezar.",
  audit_failed: "No pudimos completar la auditoría. Intenta de nuevo en unos minutos.",
};
const PRIORIDADES = { alta: "Prioridad alta", media: "Prioridad media", baja: "Prioridad baja" };
const ETIQUETAS = ["Perfil", "Frecuencia", "Conversión", "Formato"]; // notas que llegan del servidor en español
const INCLUYE = [
  ["Radiografía de tu Instagram", "Tu auditoría cada mes, para ver qué mejoró y qué sigue frenando tus ventas."],
  ["Guiones listos para grabar", "Pones tu idea y recibes el guion completo escrito en tu voz: gancho, desarrollo y cierre."],
  ["Ganchos que detienen el scroll", "10 ganchos por tema, adaptados a tu negocio, para que nadie pase de largo."],
  ["Calendario de 30 días", "Qué publicar cada día, alternando contenido que atrae, que da confianza y que vende."],
  ["Control financiero", "Registra ventas, costos y gastos, y mira cuánto ganas realmente cada mes."],
];

const { data } = await supabase.auth.getSession();
const app = renderShell(root, { active: "auditoria", session: data.session });
alTraducir(() => pintar());
pintar();

async function llamar(payload) {
  const res = await fetch(AUDITORIA_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || "audit_failed");
  return body;
}

const fmt = (n) => new Intl.NumberFormat(locale(), { notation: "compact", maximumFractionDigits: 1 }).format(Number(n || 0));

function pintar() {
  if (vista === "inicio") app.innerHTML = inicio();
  else if (vista === "cargando") app.innerHTML = cargando();
  else app.innerHTML = resultado() + (puerta ? modal() : "");
  enlazar();
}

function inicio() {
  return `
    <section class="au-hero">
      <span class="au-chip">${t("Auditoría de Instagram con IA")}</span>
      <h1>${t("Tu contenido está perdiendo <em>clientas</em>.")}<br>${t("Descubre exactamente qué cambiar.")}</h1>
      <p class="au-sub">${t("Toma menos de 60 segundos.")}</p>
      <form class="au-input" id="au-form" autocomplete="off">
        <span>@</span>
        <input id="au-handle" inputmode="text" autocapitalize="none" spellcheck="false" maxlength="31" placeholder="${t("tu_usuario")}" value="${esc(handle)}" aria-label="${t("Tu usuario de Instagram")}">
        <button class="btn" type="submit">${t("Analizar mi Instagram")} →</button>
      </form>
      <div class="msg error ${error ? "" : "hidden"}">${esc(error)}</div>
      <p class="au-lead">${t("Analizamos tu Instagram, encontramos dónde estás perdiendo atención, confianza y ventas, y te decimos qué contenido crear para vender más.")}</p>
      <ul class="au-puntos">
        <li>${t("Tu puntaje de 0 a 100, con lo que te frena")}</li>
        <li>${t("Las 3 cosas que deberías cambiar primero")}</li>
        <li>${t("2 guiones de Reel listos para grabar, para tu negocio")}</li>
        <li>${t("Tu plan de acción para los próximos 30 días")}</li>
      </ul>
      <p class="muted au-nota">${t("Funciona con cuentas profesionales (empresa o creadora). No pedimos tu contraseña.")}</p>
    </section>`;
}

function cargando() {
  return `
    <section class="au-cargando" aria-live="polite">
      <div class="au-spinner"></div>
      <h2>${t("Analizando")} <em>@${esc(handle)}</em></h2>
      <ul class="au-pasos" id="au-pasos">${PASOS.map((p) => `<li>${t(p)}</li>`).join("")}</ul>
    </section>`;
}

function cabecera() {
  const foto = teaser.profile_picture_url
    ? `<img src="${esc(teaser.profile_picture_url)}" alt="" referrerpolicy="no-referrer">`
    : `<div></div>`;
  return `
    <div class="au-avatar">${foto}</div>
    <p class="au-ig">@${esc(teaser.username)}</p>
    <div class="au-alerta">⚠️ ${t("¡Cuidado, {u}!", { u: "@" + esc(teaser.username) })}</div>
    <h1 class="au-titular">${esc(teaser.headline.lead)}<em>${esc(teaser.headline.highlight)}</em>${esc(teaser.headline.tail)}</h1>`;
}

function resultado() {
  const r = informe;
  const ai = r?.ai;
  const tarjeta = `
    <div class="au-oscura">
      <p>${t("Tu cuenta tiene {n} seguidores.", { n: `<strong>${fmt(teaser.followers)}</strong>` })}</p>
      <div class="au-grande"><b>${teaser.without_cta}</b><span>${t("de {n}", { n: teaser.sample })}</span></div>
      <p>${t("de tus últimos posts no le piden nada a quien te ve")}</p>
      <div class="au-cita">${t("Tu audiencia te ve, pero nadie sabe qué hacer después.")}</div>
    </div>`;
  if (!r) {
    return `<section class="au-res">${cabecera()}
      <p class="au-diag">${esc(teaser.diagnosis)}</p>
      ${tarjeta}
      <button class="btn block au-cta" id="au-ver">${t("Ver mi auditoría completa")}</button>
    </section>`;
  }
  const guiones = ai ? ai.guiones : r.scripts.map((s) => ({ titulo: "", gancho: s.hook, desarrollo: s.body, cta: s.cta }));
  const cambios = ai ? ai.cambios : r.top3;
  return `<section class="au-res">${cabecera()}
    <p class="au-diag">${esc(ai ? ai.diagnostico : r.diagnosis)}</p>
    ${tarjeta}

    <div class="card au-puntaje">
      <span class="label">${t("Tu auditoría personalizada")}</span>
      <div class="au-score"><b>${r.score}</b><span>/100</span></div>
      <p class="muted">${t("Potencial de tu cuenta hoy")}</p>
      <div class="au-notas">${r.scores.map((s) => `<div><b>${s.value}</b><strong>${ETIQUETAS.includes(s.label) ? t(s.label) : esc(s.label)}</strong><small>${esc(s.note)}</small></div>`).join("")}</div>
    </div>

    <div class="au-oscura">
      <span class="label au-claro">${t("Tu cuenta ahora mismo")}</span>
      <ul class="au-balas">${r.bullets.map((b) => `<li><strong>${esc(b.strong)}</strong> ${esc(b.text)}</li>`).join("")}</ul>
    </div>

    ${ai ? `<div class="card"><span class="label">${t("Hallazgos principales")}</span>
      <ul class="au-hallazgos">${ai.hallazgos.map((h) => `<li><strong>${esc(h.titulo)}</strong><p>${esc(h.detalle)}</p></li>`).join("")}</ul></div>` : ""}

    <div class="au-seccion">
      <span class="label">${t("Lo que ART LAB Tools ya preparó para ti")}</span>
      <h2>${t("Tus guiones <em>personalizados</em>")}</h2>
      <p><span class="au-chip">${t("Nicho detectado: {n}", { n: esc(ai ? ai.nicho : r.niche.label) })}</span></p>
    </div>
    ${guiones.map((g, i) => `
      <article class="card au-guion">
        <span class="au-chip">${t("Guion {n}", { n: i + 1 })}</span>
        <h3>${esc(g.gancho)}</h3>
        <p>${esc(g.desarrollo)}</p>
        <div class="au-cta-txt"><small>CTA</small>${esc(g.cta)}</div>
      </article>`).join("")}

    <div class="card au-bloqueo">
      <div class="au-borroso"><i></i><i></i><i></i></div>
      <div class="au-candado" aria-hidden="true">🔒</div>
      <h3>${t("Tu calendario de 30 días, listo")}</h3>
      <p class="muted">${t("Deja de partir de cero cada vez: ideas, ganchos y guiones armados para tu negocio, listos para grabar.")}</p>
      <a class="btn" href="${urlApp()}">${t("Desbloquear ART LAB Tools")} →</a>
    </div>

    <div class="card au-suave">
      <span class="au-chip">💡 ${t("Lo más importante")}</span>
      <h2>${t("3 cosas que deberías cambiar primero")}</h2>
      <ol class="au-top">${cambios.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>
    </div>

    ${ai ? `<div class="card"><span class="label">${t("Tu plan de acción")}</span>
      <p class="muted" style="margin:4px 0 8px">${t("Pasos para los próximos 30 días")}</p>
      <ol class="au-plan">${ai.plan.map((p) => `<li><div><strong>${esc(p.paso)}</strong><span class="au-prio ${esc(p.prioridad)}">${t(PRIORIDADES[p.prioridad] || PRIORIDADES.media)}</span></div><p>${esc(p.detalle)}</p></li>`).join("")}</ol></div>` : ""}

    ${venta()}
  </section>
  <div class="au-fija"><a class="btn block" href="${urlApp()}">${t("Comenzar ahora")}</a></div>`;
}

function venta() {
  return `
    <div class="card au-venta">
      <h2>${t("Nunca más abras Instagram <em>sin saber qué publicar</em>")}</h2>
      <p class="muted">${t("Todo lo que necesitas para que tu contenido te traiga clientas, en una sola app.")}</p>
      <ul class="au-incluye">${INCLUYE.map(([a, b]) => `<li><strong>${t(a)}</strong><span>${t(b)}</span></li>`).join("")}</ul>
      <a class="btn block au-cta" href="${urlApp()}">${t("Quiero empezar")}</a>
      <p class="muted au-nota">${t("Empiezas con 20 créditos para crear tus primeros guiones.")}</p>
    </div>`;
}

function urlApp() {
  const u = new URL("/contenido/", location.origin);
  if (teaser) u.searchParams.set("ig", teaser.username);
  if (informe) u.searchParams.set("rubro", (informe.ai?.nicho || "").slice(0, 80));
  return u.pathname + u.search;
}

function modal() {
  return `
    <div class="au-modal" role="dialog" aria-modal="true" aria-labelledby="au-modal-t">
      <form class="card" id="au-correo">
        <button type="button" class="au-cerrar" id="au-cerrar" aria-label="${t("Cerrar")}">✕</button>
        <div class="au-sobre" aria-hidden="true">✉️</div>
        <h2 id="au-modal-t">${t("Desbloquea tu auditoría")} 👀</h2>
        <p>${t("Deja tu correo y te mostramos exactamente <em>qué cambiar primero</em> en tu cuenta.")}</p>
        <div class="au-input">
          <input id="au-email" type="email" inputmode="email" autocomplete="email" placeholder="${t("tu@correo.com")}" required aria-label="${t("Tu correo")}">
          <button class="btn" type="submit" ${enviando ? "disabled" : ""}>${enviando ? t("Preparando…") : t("Desbloquear")}</button>
        </div>
        <label class="consent"><input type="checkbox" id="au-ok" checked><span>${t("Acepto la política de privacidad y recibir mi auditoría por correo.")}</span></label>
        <div class="msg error ${error ? "" : "hidden"}">${esc(error)}</div>
        <p class="muted au-nota">${t("Sin spam. Solo tu auditoría.")}</p>
      </form>
    </div>`;
}

function enlazar() {
  const $ = (id) => document.getElementById(id);
  $("au-form")?.addEventListener("submit", analizar);
  $("au-ver")?.addEventListener("click", () => { puerta = true; error = ""; pintar(); $("au-email")?.focus(); });
  $("au-cerrar")?.addEventListener("click", () => { puerta = false; pintar(); });
  $("au-correo")?.addEventListener("submit", desbloquear);
}

async function analizar(e) {
  e.preventDefault();
  handle = document.getElementById("au-handle").value.trim().replace(/^@/, "").toLowerCase();
  error = "";
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) { error = t(ERRORES.invalid_handle); return pintar(); }
  vista = "cargando"; pintar();
  const items = [...document.querySelectorAll("#au-pasos li")];
  let i = 0;
  const timer = setInterval(() => { if (i < items.length) items[i++].classList.add("on"); }, 900);
  try {
    const [res] = await Promise.all([llamar({ action: "analyze", handle, utm }), new Promise((r) => setTimeout(r, 4600))]);
    auditId = res.audit_id; teaser = res.teaser; vista = "resultado";
  } catch (x) {
    error = t(ERRORES[x.message] || ERRORES.audit_failed); vista = "inicio";
  }
  clearInterval(timer);
  pintar();
  scrollTo({ top: 0 });
}

async function desbloquear(e) {
  e.preventDefault();
  error = "";
  if (!document.getElementById("au-ok").checked) { error = t(ERRORES.consent_required); return pintar(); }
  const email = document.getElementById("au-email").value.trim();
  enviando = true; pintar();
  document.getElementById("au-email").value = email;
  try {
    const res = await llamar({ action: "unlock", audit_id: auditId, email, consent: true, lang });
    informe = res.report; puerta = false;
    try { localStorage.setItem("artlab_tools_auditoria", JSON.stringify({ id: auditId, ig: teaser.username, nicho: informe.ai?.nicho || "" })); } catch { /* sin almacenamiento */ }
  } catch (x) {
    error = t(ERRORES[x.message] || ERRORES.audit_failed);
  }
  enviando = false;
  pintar();
}
