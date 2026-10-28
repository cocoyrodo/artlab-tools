import { supabase, withSession, esc } from "/assets/auth.js?v=20261028a";
import { renderShell } from "/assets/shell.js?v=20261028a";
import { t, lang, locale, alTraducir } from "/assets/i18n.js?v=20261028a";

const root = document.getElementById("root");
let app, session, perfil = null, saldo = null, piezas = [];
let tab = "guion", abierta = null, ocupado = false, error = "", editando = false;
alTraducir(() => app && pintar());

const COSTO = { guion: 1, ganchos: 1, calendario: 5 };
// Tonos: se guardan en español (clave) y se muestran con t()
const TONOS = ["Cercano", "Profesional", "Divertido", "Inspirador", "Directo"];
const TIPOS = { guion: "Guion", ganchos: "Ganchos", calendario: "Calendario" };
const PESTANAS = { guion: "Guion", ganchos: "Ganchos", calendario: "Calendario", guardados: "Guardados" };
const PEDIDOS = {
  guion: { label: "Tu idea", ph: "Ej: por qué el esmaltado se levanta a la semana", btn: "Escribir guion", area: true },
  ganchos: { label: "Tema", ph: "Ej: precios de mis servicios", btn: "Crear 10 ganchos", area: false },
  calendario: { label: "Foco del mes (opcional)", ph: "Ej: llenar la agenda de diciembre", btn: "Armar mis 30 días", area: false },
};
const ERRORES = {
  sin_creditos: "Te quedaste sin créditos.",
  ia_no_configurada: "La IA todavía no está activada. Inténtalo más tarde.",
  ocupado: "Hay mucha demanda en este momento. Inténtalo en un minuto.",
  rechazado: "No pudimos escribir sobre ese tema. Prueba con otra idea.",
  falta_idea: "Escribe tu idea primero.",
  ia_fallida: "No pudimos crear tu contenido. No se descontaron créditos.",
};

withSession(root, async (s) => {
  session = s;
  app = renderShell(root, { active: "contenido", session: s });
  app.innerHTML = `<p class="muted center" style="margin-top:40px">${t("Cargando tus datos…")}</p>`;
  await cargar();
}, { title: t("Entra a tu estudio de contenido") });

supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.href = "/"; });

async function cargar() {
  const [{ data: p }, { data: c }, { data: lista }] = await Promise.all([
    supabase.from("contenido_perfil").select("*").eq("user_id", session.user.id).maybeSingle(),
    supabase.from("contenido_creditos").select("saldo").eq("user_id", session.user.id).maybeSingle(),
    supabase.from("contenido_piezas").select("id, tipo, pedido, resultado, created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  perfil = p;
  saldo = c ? c.saldo : 20; // la fila se crea con 20 en el primer uso
  piezas = lista || [];
  editando = !perfil;
  pintar();
}

const fecha = (f) => new Date(f).toLocaleDateString(locale(), { day: "numeric", month: "short" });

function pintar() {
  app.innerHTML = `
    <section class="hello">
      <small>${t("Contenido")}</small>
      <h1>${t("Guiones que <em>venden</em>")}</h1>
      <p class="sub">${t("Tu idea, escrita como guion listo para grabar, con tu voz y un llamado a la acción claro.")}</p>
    </section>
    <div class="ct-bar">
      <span class="ct-chip">${t("{n} créditos", { n: saldo ?? "…" })}</span>
      ${perfil && !editando ? `<button class="linkbtn" id="ct-marca">${t("Editar mi marca")}</button>` : ""}
    </div>
    ${editando ? formMarca() : estudio()}`;
  enlazar();
}

function formMarca() {
  const v = (k) => esc(perfil?.[k] || "");
  return `
    <form class="card stack" id="ct-perfil">
      <span class="label">${t("Tu marca")}</span>
      <h2 style="font-size:22px">${t("Cuéntanos de tu <em>negocio</em>")}</h2>
      <p class="muted" style="margin:0;font-size:14px">${t("Con esto la IA escribe como tú y para tu clienta. Lo puedes cambiar cuando quieras.")}</p>
      <div class="campo"><label for="p-rubro">${t("Rubro")}</label><input id="p-rubro" maxlength="80" required value="${v("rubro")}" placeholder="${t("Ej: uñas, repostería, psicología, ropa")}"></div>
      <div class="campo"><label for="p-negocio">${t("Tu negocio en una frase")}</label><input id="p-negocio" maxlength="200" value="${v("negocio")}" placeholder="${t("Ej: estudio de uñas en Santiago, atiendo con hora")}"></div>
      <div class="campo"><label for="p-oferta">${t("Qué vendes")}</label><input id="p-oferta" maxlength="200" value="${v("oferta")}" placeholder="${t("Ej: soft gel, nail art, cursos")}"></div>
      <div class="campo"><label for="p-publico">${t("Tu clienta ideal")}</label><input id="p-publico" maxlength="200" value="${v("publico")}" placeholder="${t("Ej: mujeres de 25 a 40 que trabajan y quieren verse bien")}"></div>
      <div class="row">
        <div class="campo"><label for="p-tono">${t("Tono")}</label><select id="p-tono">${TONOS.map((x) => `<option value="${x}" ${perfil?.tono === x ? "selected" : ""}>${t(x)}</option>`).join("")}</select></div>
        <div class="campo"><label for="p-ig">${t("Tu Instagram")}</label><input id="p-ig" maxlength="40" value="${v("instagram")}" placeholder="@"></div>
      </div>
      <div class="campo"><label for="p-voz">${t("Pega 2 o 3 textos tuyos")}</label><textarea id="p-voz" rows="5" maxlength="4000" placeholder="${t("Captions que ya publicaste. Así la IA aprende cómo escribes.")}">${v("voz")}</textarea></div>
      <div class="msg error ${error ? "" : "hidden"}">${esc(error)}</div>
      <div class="actions">
        ${perfil ? `<button type="button" class="btn ghost" id="p-cancel">${t("Cancelar")}</button>` : ""}
        <span style="flex:1"></span>
        <button type="submit" class="btn">${t("Guardar")}</button>
      </div>
    </form>`;
}

function estudio() {
  return `
    <div class="ct-tabs" role="tablist">
      ${Object.keys(PESTANAS).map((k) => `<button role="tab" class="ct-tab ${tab === k ? "on" : ""}" data-tab="${k}" aria-selected="${tab === k}">${t(PESTANAS[k])}</button>`).join("")}
    </div>
    ${tab === "guardados" ? guardados() : pedidoForm()}
    ${abierta ? vista(abierta) : ""}`;
}

function pedidoForm() {
  const cfg = PEDIDOS[tab];
  const campo = cfg.area
    ? `<textarea id="ct-pedido" rows="3" maxlength="500" placeholder="${t(cfg.ph)}"></textarea>`
    : `<input id="ct-pedido" maxlength="500" placeholder="${t(cfg.ph)}">`;
  return `
    <form class="card stack" id="ct-form">
      <div class="campo"><label for="ct-pedido">${t(cfg.label)}</label>${campo}</div>
      <div class="msg error ${error ? "" : "hidden"}">${esc(error)}</div>
      <button class="btn block" type="submit" ${ocupado ? "disabled" : ""}>
        ${ocupado ? t("Escribiendo…") : `${t(cfg.btn)} · ${COSTO[tab] === 1 ? t("1 crédito") : t("{n} créditos", { n: COSTO[tab] })}`}
      </button>
    </form>`;
}

function guardados() {
  if (!piezas.length) return `<div class="card center"><p class="muted" style="margin:0">${t("Todavía no tienes contenido guardado.")}</p></div>`;
  return `<ul class="card ct-lista">${piezas.map((p) => `
    <li data-id="${p.id}">
      <span class="ct-chip">${t(TIPOS[p.tipo])}</span>
      <span class="ct-lista-txt">${esc(p.tipo === "guion" ? p.resultado.titulo : p.pedido || t(TIPOS[p.tipo]))}</span>
      <small class="muted">${fecha(p.created_at)}</small>
    </li>`).join("")}</ul>`;
}

const copiar = (txt) => `<button type="button" class="ct-copy" data-copy="${esc(txt)}">${t("Copiar")}</button>`;

function vista(p) {
  const r = p.resultado;
  let cuerpo = "";
  if (p.tipo === "guion") {
    const todo = [r.gancho, r.desarrollo, r.cierre, r.cta].join("\n\n");
    cuerpo = `
      <h2 class="ct-titulo">${esc(r.titulo)}</h2>
      <p class="muted" style="margin:0 0 12px;font-size:13px">${t("Duración aproximada: {n} segundos", { n: r.duracion_segundos })}</p>
      ${bloque(t("Gancho"), r.gancho, true)}
      ${bloque(t("Desarrollo"), r.desarrollo)}
      ${bloque(t("Cierre"), r.cierre)}
      ${bloque(t("Llamado a la acción"), r.cta, true)}
      <div class="ct-bloque"><small>${t("Texto en pantalla")}</small><ul>${r.texto_en_pantalla.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="ct-bloque"><small>${t("Caption")} ${copiar(r.caption + "\n\n" + r.hashtags.map((h) => "#" + h).join(" "))}</small><p>${esc(r.caption)}</p><p class="ct-tags">${r.hashtags.map((h) => "#" + esc(h)).join(" ")}</p></div>
      <div class="actions"><button type="button" class="btn ct-copy" data-copy="${esc(todo)}">${t("Copiar guion completo")}</button></div>`;
  } else if (p.tipo === "ganchos") {
    cuerpo = `<ol class="ct-ganchos">${r.ganchos.map((g) => `<li><strong>${esc(g.texto)}</strong> ${copiar(g.texto)}<small>${esc(g.por_que)}</small></li>`).join("")}</ol>`;
  } else {
    cuerpo = `<ul class="ct-dias">${r.dias.map((d) => `
      <li><span class="ct-dia">${d.dia}</span><div><strong>${esc(d.tema)}</strong><small>${esc(d.formato)} · ${esc(d.objetivo)}</small><p>${esc(d.gancho)}</p></div></li>`).join("")}</ul>`;
  }
  return `
    <article class="card ct-vista" id="ct-vista">
      <div class="ct-vista-top"><span class="label">${t(TIPOS[p.tipo])}</span>
        <button type="button" class="linkbtn" id="ct-borrar">${t("Eliminar")}</button></div>
      ${cuerpo}
    </article>`;
}

const bloque = (titulo, txt, fuerte = false) =>
  `<div class="ct-bloque"><small>${titulo} ${copiar(txt)}</small><p class="${fuerte ? "ct-fuerte" : ""}">${esc(txt)}</p></div>`;

function enlazar() {
  const $ = (id) => document.getElementById(id);
  $("ct-marca")?.addEventListener("click", () => { editando = true; error = ""; pintar(); });
  $("p-cancel")?.addEventListener("click", () => { editando = false; error = ""; pintar(); });
  $("ct-perfil")?.addEventListener("submit", guardarPerfil);
  $("ct-form")?.addEventListener("submit", generar);
  $("ct-borrar")?.addEventListener("click", borrar);
  app.querySelectorAll(".ct-tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; abierta = null; error = ""; pintar(); }));
  app.querySelectorAll(".ct-lista li").forEach((li) => li.addEventListener("click", () => {
    abierta = piezas.find((p) => p.id === li.dataset.id); pintar();
    document.getElementById("ct-vista")?.scrollIntoView({ behavior: "smooth" });
  }));
  app.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("Copiado"); } catch { /* sin portapapeles */ }
  }));
}

async function guardarPerfil(e) {
  e.preventDefault();
  const v = (id) => document.getElementById(id).value.trim();
  const fila = {
    user_id: session.user.id, rubro: v("p-rubro"), negocio: v("p-negocio"), oferta: v("p-oferta"),
    publico: v("p-publico"), tono: v("p-tono"), instagram: v("p-ig").replace(/^@/, ""), voz: v("p-voz"),
    updated_at: new Date().toISOString(),
  };
  if (!fila.rubro) { error = t("Escribe tu rubro."); return pintar(); }
  const { error: err } = await supabase.from("contenido_perfil").upsert(fila);
  if (err) { error = t("No pudimos guardar. Inténtalo de nuevo."); return pintar(); }
  perfil = fila; editando = false; error = ""; pintar();
}

async function generar(e) {
  e.preventDefault();
  if (ocupado) return;
  const pedido = document.getElementById("ct-pedido").value.trim();
  if (tab === "guion" && pedido.length < 3) { error = t(ERRORES.falta_idea); return pintar(); }
  ocupado = true; error = ""; abierta = null; pintar();
  try {
    const { data, error: err } = await supabase.functions.invoke("contenido-ia", { body: { tipo: tab, pedido, lang } });
    if (err) {
      const cuerpo = await err.context?.json?.().catch(() => null);
      throw new Error(cuerpo?.error || "ia_fallida");
    }
    saldo = data.saldo;
    piezas.unshift(data.pieza);
    abierta = data.pieza;
  } catch (x) {
    error = t(ERRORES[x.message] || ERRORES.ia_fallida);
  }
  ocupado = false;
  pintar();
  document.getElementById("ct-vista")?.scrollIntoView({ behavior: "smooth" });
}

async function borrar() {
  if (!abierta || !confirm(t("¿Eliminar este contenido?"))) return;
  const { error: err } = await supabase.from("contenido_piezas").delete().eq("id", abierta.id);
  if (err) return;
  piezas = piezas.filter((p) => p.id !== abierta.id);
  abierta = null;
  pintar();
}
