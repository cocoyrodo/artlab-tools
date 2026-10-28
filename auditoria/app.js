import { supabase, esc, renderAuth } from "/assets/auth.js?v=20261028c";
import { renderShell } from "/assets/shell.js?v=20261028c";
import { t, lang, locale, alTraducir } from "/assets/i18n.js?v=20261028c";
import { AUDITORIA_URL } from "/assets/config.js?v=20261028c";

// Laboratorio de Instagram. Sin cuenta: muestra → análisis → resultados con valores de
// referencia. Con cuenta: la receta (ajustes, guiones y plan) y la evolución mes a mes.
// La lectura de Instagram y la receta las hace la Edge Function artlab-ig-audit (proyecto ART LAB).
// Mientras la persona confirma su correo, el análisis queda en este dispositivo (PENDIENTE).

const root = document.getElementById("root");
const qs = new URLSearchParams(location.search);
const utm = {};
["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"].forEach((k) => { if (qs.get(k)) utm[k] = qs.get(k).slice(0, 80); });
const PENDIENTE = "artlab_tools_laboratorio";

let session = (await supabase.auth.getSession()).data.session;
let vista = "inicio", handle = (qs.get("u") || "").replace(/^@/, ""), error = "", ocupado = false;
let muestra = null; // { audit_id, teaser, metrics, fecha }
let receta = null, previo = null, ultimo = null;

const PASOS = ["Muestra recibida", "Leyendo tus últimos 12 posts", "Midiendo 6 indicadores", "Comparando con valores de referencia", "Resultados listos"];
const ERRORES = {
  invalid_handle: "Ese usuario no es válido: usa solo letras, números, puntos y guiones bajos.",
  not_professional: "No pudimos tomar la muestra. El laboratorio funciona con cuentas profesionales (empresa o creadora); puedes cambiarla en Instagram → Configuración → Tipo de cuenta. Revisa también que el usuario esté bien escrito.",
  rate_limited: "Hiciste varios análisis seguidos. Vuelve a intentarlo en un rato.",
  busy: "El laboratorio está con mucha demanda. Inténtalo en unos minutos.",
  audit_expired: "Esta muestra ya no está disponible. Haz un análisis nuevo.",
  unauthorized: "Tu sesión terminó. Entra de nuevo para ver tu receta.",
  audit_failed: "No pudimos terminar el análisis. Inténtalo en unos minutos.",
};
const ESTADOS = { ok: "En rango", medio: "Mejorable", bajo: "Fuera de rango" };
const PRIORIDADES = { alta: "Prioridad alta", media: "Prioridad media", baja: "Prioridad baja" };

const app = renderShell(root, { active: "auditoria", session });
alTraducir(() => pintar());

async function iniciar() {
  try {
    const p = JSON.parse(localStorage.getItem(PENDIENTE) || "null");
    if (p && Date.now() - Date.parse(p.fecha) < 6 * 24 * 3600000) { muestra = p; handle = p.teaser.username; vista = "resultados"; }
  } catch { /* sin almacenamiento */ }
  if (session) {
    const { data } = await supabase.from("instagram_analisis").select("*").order("created_at", { ascending: false }).limit(20);
    const lista = data || [];
    ultimo = lista[0] || null;
    if (muestra) {
      previo = lista.find((a) => a.handle === muestra.teaser.username && a.audit_id !== muestra.audit_id) || null;
      const guardado = lista.find((a) => a.audit_id === muestra.audit_id);
      if (guardado?.receta) receta = guardado.receta;
    }
  }
  pintar();
  if (session && muestra && !receta) pedirReceta();
}

async function llamar(payload) {
  const res = await fetch(AUDITORIA_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || "audit_failed");
  return body;
}

const num = (n) => new Intl.NumberFormat(locale(), { notation: "compact", maximumFractionDigits: 1 }).format(Number(n || 0));
const fecha = (f) => new Date(f).toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });

// Los 6 indicadores y sus valores de referencia (criterio ART LAB)
function indicadores(m) {
  const conCta = m.sample - m.without_cta, r = m.sample ? conCta / m.sample : 0;
  const nivel = (v, ok, medio) => (v >= ok ? "ok" : v >= medio ? "medio" : "bajo");
  return [
    { k: "cta", nombre: t("Posts que piden una acción"), valor: t("{n} de {total}", { n: conCta, total: m.sample }), rango: t("2 de cada 3 o más"), estado: nivel(r, 2 / 3, 1 / 3), v: conCta },
    { k: "frecuencia", nombre: t("Publicaciones en 30 días"), valor: String(m.posts_30d), rango: t("12 o más"), estado: nivel(m.posts_30d, 12, 6), v: m.posts_30d },
    { k: "reels", nombre: t("Reels y videos"), valor: `${m.video_pct} %`, rango: t("60 % o más"), estado: nivel(m.video_pct, 60, 30), v: m.video_pct },
    { k: "interaccion", nombre: t("Interacción por post"), valor: `${m.engagement_pct} %`, rango: t("2 % o más"), estado: nivel(m.engagement_pct, 2, 1), v: m.engagement_pct },
    { k: "bio", nombre: t("Bio que dice cómo comprarte"), valor: m.bio_has_cta ? t("Sí") : t("No"), rango: t("Sí"), estado: m.bio_has_cta ? "ok" : "bajo", v: m.bio_has_cta ? 1 : 0 },
    { k: "enlace", nombre: t("Enlace en la bio"), valor: m.has_website ? t("Sí") : t("No"), rango: t("Sí"), estado: m.has_website ? "ok" : "bajo", v: m.has_website ? 1 : 0 },
  ];
}

function pintar() {
  if (vista === "inicio") app.innerHTML = inicio();
  else if (vista === "cargando") app.innerHTML = cargando();
  else app.innerHTML = informe();
  enlazar();
}

function inicio() {
  return `
    <section class="lab-hero">
      <span class="lab-chip">${t("Laboratorio de Instagram")}</span>
      <h1>${t("Haz el análisis de laboratorio de tu <em>Instagram</em>")}</h1>
      <p class="lab-sub">${t("Leemos tus últimos 12 posts y comparamos tu cuenta con valores de referencia: verás qué está sano y qué está frenando tus ventas.")}</p>
      <form class="lab-input" id="lab-form" autocomplete="off">
        <span>@</span>
        <input id="lab-handle" inputmode="text" autocapitalize="none" spellcheck="false" maxlength="31" placeholder="${t("tu_usuario")}" value="${esc(handle)}" aria-label="${t("Tu usuario de Instagram")}">
        <button class="btn" type="submit">${t("Analizar")}</button>
      </form>
      <div class="msg error ${error ? "" : "hidden"}">${esc(error)}</div>
      <p class="muted lab-nota">${t("Funciona con cuentas profesionales (empresa o creadora). No pedimos tu contraseña.")}</p>
    </section>
    <ol class="lab-pasos-inicio">
      <li><b>1</b><div><strong>${t("La muestra")}</strong><span>${t("Tu usuario de Instagram. Nada más.")}</span></div></li>
      <li><b>2</b><div><strong>${t("El análisis")}</strong><span>${t("6 indicadores de tu cuenta, cada uno con su rango sano.")}</span></div></li>
      <li><b>3</b><div><strong>${t("La receta")}</strong><span>${t("Ajustes, guiones y un plan de 30 días para tu negocio.")}</span></div></li>
    </ol>
    ${session && ultimo ? `<button class="card lab-ultimo" id="lab-ultimo"><span class="label">${t("Tu último análisis")}</span><strong>@${esc(ultimo.handle)}</strong><small class="muted">${fecha(ultimo.created_at)}</small></button>` : ""}`;
}

function cargando() {
  return `
    <section class="lab-cargando" aria-live="polite">
      <div class="lab-tubo"><div></div></div>
      <h2>${t("Analizando la muestra de {u}", { u: `<em>@${esc(handle)}</em>` })}</h2>
      <ul class="lab-pasos" id="lab-pasos">${PASOS.map((p) => `<li>${t(p)}</li>`).join("")}</ul>
    </section>`;
}

function informe() {
  const tz = muestra.teaser, m = muestra.metrics, ind = indicadores(m);
  const fuera = ind.filter((i) => i.estado !== "ok");
  const peor = ind.find((i) => i.estado === "bajo") || fuera[0];
  const antes = previo ? indicadores(previo.resultados) : null;
  const foto = tz.profile_picture_url ? `<img src="${esc(tz.profile_picture_url)}" alt="" referrerpolicy="no-referrer">` : "<div></div>";
  return `
    <article class="lab-ficha">
      <header class="lab-ficha-top">
        <span>${t("Informe de laboratorio")}</span>
        <span>${t("Muestra N° {n}", { n: muestra.audit_id.slice(0, 6).toUpperCase() })}</span>
      </header>
      <div class="lab-paciente">
        <div class="lab-foto">${foto}</div>
        <div>
          <strong>@${esc(tz.username)}</strong>
          <small>${t("{n} seguidores", { n: num(tz.followers) })} · ${t("{n} posts analizados", { n: m.sample })}</small>
          <small>${fecha(muestra.fecha)}</small>
        </div>
      </div>
      <p class="lab-diag">${fuera.length
        ? t("{n} de 6 indicadores fuera de lo sano. El más urgente: {i}.", { n: fuera.length, i: `<strong>${esc(peor.nombre)}</strong>` })
        : t("Tus 6 indicadores están en rango. El siguiente paso es convertir esa atención en ventas.")}</p>
      <table class="lab-tabla">
        <thead><tr><th>${t("Indicador")}</th><th>${t("Resultado")}</th>${antes ? `<th>${t("Antes")}</th>` : ""}<th>${t("Rango sano")}</th></tr></thead>
        <tbody>${ind.map((i, n) => `
          <tr class="${i.estado}">
            <td>${esc(i.nombre)}<small>${t(ESTADOS[i.estado])}</small></td>
            <td class="lab-valor">${esc(i.valor)}</td>
            ${antes ? `<td class="lab-antes">${esc(antes[n].valor)}</td>` : ""}
            <td class="lab-rango">${esc(i.rango)}</td>
          </tr>`).join("")}</tbody>
      </table>
      <p class="lab-pie">${t("Valores de referencia de ART LAB para cuentas de negocio que venden por Instagram.")}</p>
    </article>
    ${receta ? verReceta() : bloqueada()}`;
}

function bloqueada() {
  return `
    <section class="card lab-receta lab-cerrada">
      <span class="label">${t("Tu receta")}</span>
      <h2>${t("Qué hacer con estos <em>resultados</em>")}</h2>
      <ul class="lab-incluye">
        <li>${t("3 ajustes prioritarios para tu cuenta")}</li>
        <li>${t("2 guiones de Reel para tu negocio")}</li>
        <li>${t("Un plan para los próximos 30 días")}</li>
      </ul>
      <div class="msg error ${error ? "" : "hidden"}">${esc(error)}</div>
      ${session
        ? `<button class="btn block" id="lab-receta" ${ocupado ? "disabled" : ""}>${ocupado ? t("Preparando tu receta…") : t("Ver mi receta")}</button>`
        : `<button class="btn block" id="lab-crear">${t("Crear mi cuenta y ver mi receta")}</button>
           <button class="linkbtn lab-entrar" id="lab-entrar">${t("Ya tengo cuenta")}</button>
           <p class="muted lab-nota">${t("Con tu cuenta, tu análisis queda guardado para compararlo el próximo mes.")}</p>`}
    </section>`;
}

function verReceta() {
  const r = receta;
  return `
    <section class="card lab-receta">
      <span class="label">${t("Tu receta")}</span>
      ${r.nicho ? `<p class="lab-nicho">${esc(r.nicho)}</p>` : ""}
      <p class="lab-diag">${esc(r.diagnostico)}</p>
      ${r.hallazgos?.length ? `<h3>${t("Lo que encontramos")}</h3><ul class="lab-hallazgos">${r.hallazgos.map((h) => `<li><strong>${esc(h.titulo)}</strong><p>${esc(h.detalle)}</p></li>`).join("")}</ul>` : ""}
      <h3>${t("Ajustes prioritarios")}</h3>
      <ol class="lab-ajustes">${r.ajustes.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
    </section>
    ${r.guiones.map((g, i) => `
      <section class="card lab-guion">
        <span class="lab-chip">${t("Guion {n}", { n: i + 1 })}</span>
        <h3>${esc(g.gancho)}</h3>
        <p>${esc(g.desarrollo)}</p>
        <div class="lab-cta"><small>${t("Llamado a la acción")}</small>${esc(g.cta)}</div>
        <button class="btn ghost small" data-copy="${esc([g.gancho, g.desarrollo, g.cta].join("\n\n"))}">${t("Copiar")}</button>
      </section>`).join("")}
    ${r.plan?.length ? `<section class="card"><span class="label">${t("Plan de 30 días")}</span>
      <ol class="lab-plan">${r.plan.map((p) => `<li><div><strong>${esc(p.paso)}</strong><span class="lab-prio ${esc(p.prioridad)}">${t(PRIORIDADES[p.prioridad] || PRIORIDADES.media)}</span></div><p>${esc(p.detalle)}</p></li>`).join("")}</ol></section>` : ""}
    ${laboratorio()}`;
}

function laboratorio() {
  const q = new URLSearchParams({ ig: muestra.teaser.username, rubro: (receta?.nicho || "").slice(0, 80) });
  return `
    <section class="lab-app">
      <span class="lab-chip">ART LAB Tools</span>
      <h2>${t("Tu laboratorio de <em>contenido</em>")}</h2>
      <p class="muted">${t("Analiza tu cuenta, planifica lo que publicas y ordena tu negocio, en una sola app.")}</p>
      <div class="lab-partes">
        <div class="card"><strong>${t("Instagram")}</strong><span>${t("Repite el análisis cada mes y mira tu evolución.")}</span></div>
        <div class="card"><strong>${t("Contenido")}</strong><span>${t("Guiones, ganchos y calendario escritos con tu voz.")}</span></div>
        <div class="card"><strong>${t("Finanzas")}</strong><span>${t("Ventas, gastos y lo que realmente ganas cada mes.")}</span></div>
      </div>
      <a class="btn block" href="/contenido/?${q}">${t("Ir a Contenido")}</a>
    </section>`;
}

function enlazar() {
  const $ = (id) => document.getElementById(id);
  $("lab-form")?.addEventListener("submit", analizar);
  $("lab-receta")?.addEventListener("click", pedirReceta);
  $("lab-crear")?.addEventListener("click", () => cuenta("signup"));
  $("lab-entrar")?.addEventListener("click", () => cuenta("login"));
  $("lab-ultimo")?.addEventListener("click", () => {
    muestra = { audit_id: ultimo.audit_id, teaser: { username: ultimo.handle, followers: ultimo.resultados.followers, profile_picture_url: "" }, metrics: ultimo.resultados, fecha: ultimo.created_at };
    receta = ultimo.receta; previo = null; vista = "resultados"; pintar(); scrollTo({ top: 0 });
  });
  app.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("Copiado"); } catch { /* sin portapapeles */ }
  }));
}

async function analizar(e) {
  e.preventDefault();
  handle = document.getElementById("lab-handle").value.trim().replace(/^@/, "").toLowerCase();
  error = "";
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) { error = t(ERRORES.invalid_handle); return pintar(); }
  vista = "cargando"; pintar();
  const items = [...document.querySelectorAll("#lab-pasos li")];
  let i = 0;
  const timer = setInterval(() => { if (i < items.length) items[i++].classList.add("on"); }, 850);
  try {
    const [res] = await Promise.all([llamar({ action: "analyze", handle, utm }), new Promise((r) => setTimeout(r, 4400))]);
    muestra = { audit_id: res.audit_id, teaser: res.teaser, metrics: res.metrics, fecha: new Date().toISOString() };
    receta = null; previo = null;
    try { localStorage.setItem(PENDIENTE, JSON.stringify(muestra)); } catch { /* sin almacenamiento */ }
    if (session) {
      const { data } = await supabase.from("instagram_analisis").select("*").eq("handle", handle).order("created_at", { ascending: false }).limit(1);
      previo = data?.[0] || null;
    }
    vista = "resultados";
  } catch (x) {
    error = t(ERRORES[x.message] || ERRORES.audit_failed); vista = "inicio";
  }
  clearInterval(timer);
  pintar();
  scrollTo({ top: 0 });
}

// Crear cuenta o entrar sin salir del laboratorio; al volver se pide la receta
function cuenta(modo) {
  const capa = document.createElement("div");
  capa.className = "lab-capa";
  document.body.appendChild(capa);
  const caja = document.createElement("div");
  capa.appendChild(caja);
  const cerrar = document.createElement("button");
  cerrar.className = "lab-cerrar"; cerrar.type = "button"; cerrar.textContent = "✕"; cerrar.setAttribute("aria-label", t("Cerrar"));
  cerrar.onclick = () => capa.remove();
  capa.appendChild(cerrar);
  renderAuth(caja, {
    initialMode: modo,
    title: t("Entra para ver tu receta"),
    onReady: (s) => { session = s; capa.remove(); location.reload(); },
  });
}

async function pedirReceta() {
  if (ocupado || !muestra) return;
  ocupado = true; error = ""; pintar();
  try {
    const res = await llamar({ action: "receta", audit_id: muestra.audit_id, tools_token: session.access_token, lang });
    receta = res.receta;
    const { data: ya } = await supabase.from("instagram_analisis").select("id").eq("audit_id", muestra.audit_id).maybeSingle();
    if (ya) await supabase.from("instagram_analisis").update({ receta }).eq("id", ya.id);
    else await supabase.from("instagram_analisis").insert({ user_id: session.user.id, handle: muestra.teaser.username, audit_id: muestra.audit_id, resultados: { ...muestra.metrics, followers: muestra.teaser.followers }, receta });
    try { localStorage.removeItem(PENDIENTE); } catch { /* sin almacenamiento */ }
  } catch (x) {
    error = t(ERRORES[x.message] || ERRORES.audit_failed);
  }
  ocupado = false;
  pintar();
}

await iniciar();
