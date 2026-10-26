import { supabase, withSession, esc } from "/assets/auth.js?v=20261026i";
import { renderShell } from "/assets/shell.js?v=20261026i";
import { t, locale, traducirEstaticos, alTraducir } from "/assets/i18n.js?v=20261026i";
import { MONEDAS, monedaDelPais } from "/assets/monedas.js?v=20261026i";
import { resumenMes, pendientes, porServicio, ultimosMeses, moverMes, mesDe, toCSV, calcularComision, resultadoAnual } from "./calc.js?v=20261026i";

const root = document.getElementById("root");
let app; // contenedor de la vista, dentro de la estructura común
const dlg = document.getElementById("mov-dialog");
const form = document.getElementById("mov-form");
const $ = (id) => document.getElementById(id);
traducirEstaticos(dlg);

const CATEGORIAS = {
  venta: ["Servicio", "Propina", "Producto", "Curso / clase", "Otro"],
  costo: ["Esmaltes y geles", "Uñas / tips", "Decoración", "Desechables", "Otro material"],
  gasto: ["Arriendo", "Arriendo de silla / espacio", "Luz / agua / internet", "Publicidad", "Transporte", "Herramientas / equipos", "Capacitación", "Comisiones / bancos", "Otro"],
};
const TITULOS = { venta: "venta", costo: "costo de material", gasto: "gasto" };

// Las categorías se guardan en español (son la clave) y se muestran traducidas con t().
// Cómo trabaja la manicurista; cambia textos y el formulario de ventas
const MODALIDADES = {
  independiente: { nombre: "Independiente", detalle: "Tengo mi propio espacio o atiendo a domicilio. Todo lo que cobro es mío." },
  comision: { nombre: "Por comisión en un salón", detalle: "El salón cobra a la clienta y me paga un porcentaje." },
  arriendo: { nombre: "Arriendo un espacio o silla", detalle: "Cobro todo a mis clientas y le pago un arriendo al salón." },
  otro: { nombre: "Otro / mixto", detalle: "Combino formas de trabajo, por ejemplo salón y clientas propias." },
};

let session, movs = [], moneda = "CLP", monedaManual = false, paisIso = null;
let perfil = { modalidad: null, comision_pct: null, materiales_salon: false };
let mes = new Date().toISOString().slice(0, 7);
let editId = null;
let repintar = null; // vista actual, para volver a pintarla cuando llegan traducciones nuevas
alTraducir(() => app && repintar?.());

const hoy = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
// Sin decimales cuando el monto es entero (US$7 en vez de US$7,00)
// Negativos como "−US$5" en vez de "US$-5"
const fmt = (n) => {
  const v = Number(n || 0);
  const txt = new Intl.NumberFormat(locale(), { style: "currency", currency: moneda, minimumFractionDigits: 0, maximumFractionDigits: moneda === "CLP" || Number.isInteger(v) ? 0 : 2 }).format(Math.abs(v));
  return v < 0 ? "−" + txt : txt;
};
const pctTxt = (n) => `${Number(n).toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
const nombreMes = (m, opts = { month: "long", year: "numeric" }) => {
  const txt = new Date(m + "-15T12:00:00").toLocaleDateString(locale(), opts);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
};
const fechaCorta = (f) => new Date(f + "T12:00:00").toLocaleDateString(locale(), { day: "numeric", month: "short" });
const usaComision = () => perfil.modalidad === "comision" || perfil.modalidad === "otro";

withSession(root, async (s) => {
  session = s;
  app = renderShell(root, { active: "finanzas", session: s });
  app.innerHTML = `<p class="muted center" style="margin-top:40px">${t("Cargando tus datos…")}</p>`;
  await cargar();
}, { title: t("Entra a tu control financiero") });

supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.href = "/"; });

async function cargar() {
  const [{ data: p }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("moneda, moneda_manual, pais_iso, modalidad, comision_pct, materiales_salon").eq("id", session.user.id).maybeSingle(),
    supabase.from("fin_movements").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(10000),
  ]);
  if (error) {
    app.innerHTML = `<div class="msg error" style="margin-top:24px">${t("No pudimos cargar tus datos. Revisa tu conexión y recarga la página.")}</div>`;
    return;
  }
  if (p?.moneda) moneda = p.moneda;
  monedaManual = Boolean(p?.moneda_manual);
  paisIso = p?.pais_iso ?? null;
  if (p) perfil = { modalidad: p.modalidad, comision_pct: p.comision_pct, materiales_salon: p.materiales_salon };
  movs = data;
  if (!perfil.modalidad || new URLSearchParams(location.search).has("modo")) renderModalidad(!perfil.modalidad);
  else render();
}

// Pregunta "¿Cómo trabajas?" (primera vez, o desde "Tus datos")
function renderModalidad(primeraVez = false) {
  repintar = () => renderModalidad(primeraVez);
  const actual = perfil.modalidad || "";
  app.innerHTML = `
    <section class="hello">
      <small>${t("Control financiero")}</small>
      <h1>${t("¿Cómo <em>trabajas</em>?")}</h1>
      <p class="sub">${t("Así calculamos bien lo que realmente ganas. Puedes cambiarlo cuando quieras.")}</p>
    </section>
    <form class="stack" id="mod-form" novalidate>
      <div class="modos" role="radiogroup" aria-label="${t("Forma de trabajo")}">
        ${Object.entries(MODALIDADES).map(([id, m]) => `
          <label class="card modo">
            <input type="radio" name="modalidad" value="${id}" ${actual === id ? "checked" : ""}>
            <span><b>${t(m.nombre)}</b><small>${t(m.detalle)}</small></span>
          </label>`).join("")}
      </div>
      <div class="card stack hidden" id="mod-com">
        <div class="campo">
          <label for="mod-pct">${t("¿Qué porcentaje de lo que paga la clienta recibes tú?")}</label>
          <input id="mod-pct" type="number" inputmode="decimal" min="1" max="100" step="any" placeholder="${t("Ej: 40")}" value="${perfil.comision_pct ?? ""}">
          <small class="help">${t("Si cada servicio tiene un % distinto, pon el más común. Lo puedes cambiar en cada venta.")}</small>
        </div>
        <label class="consent" for="mod-mat"><input id="mod-mat" type="checkbox" ${perfil.materiales_salon ? "checked" : ""}><span>${t("El salón pone los materiales (esmaltes, geles, tips…)")}</span></label>
      </div>
      <div class="msg error hidden" id="mod-error"></div>
      <button class="btn block" type="submit">${primeraVez ? t("Continuar") : t("Guardar")}</button>
      ${primeraVez ? "" : `<button class="btn ghost block" type="button" id="mod-cancel">${t("Volver")}</button>`}
    </form>`;

  const sync = () => {
    const v = app.querySelector("input[name=modalidad]:checked")?.value;
    $("mod-com").classList.toggle("hidden", !(v === "comision" || v === "otro"));
  };
  app.querySelectorAll("input[name=modalidad]").forEach((r) => (r.onchange = sync));
  sync();
  $("mod-cancel")?.addEventListener("click", () => { history.replaceState(null, "", location.pathname); render(); });

  $("mod-form").onsubmit = async (e) => {
    e.preventDefault();
    const fail = (msg) => { $("mod-error").textContent = msg; $("mod-error").classList.remove("hidden"); };
    const modalidad = app.querySelector("input[name=modalidad]:checked")?.value;
    if (!modalidad) return fail(t("Elige cómo trabajas."));
    let comision_pct = null, materiales_salon = false;
    if (modalidad === "comision" || modalidad === "otro") {
      comision_pct = Number(String($("mod-pct").value).replace(",", "."));
      if (modalidad === "comision" && !(comision_pct > 0 && comision_pct <= 100)) return fail(t("Escribe tu porcentaje de comisión, entre 1 y 100."));
      if (!(comision_pct > 0 && comision_pct <= 100)) comision_pct = null;
      materiales_salon = $("mod-mat").checked;
    }
    const cambios = { modalidad, comision_pct, materiales_salon };
    const { error: err } = await supabase.from("profiles").update(cambios).eq("id", session.user.id);
    if (err) return fail(t("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."));
    perfil = cambios;
    history.replaceState(null, "", location.pathname);
    render();
  };
}

function render() {
  repintar = render;
  const r = resumenMes(movs, mes);
  const p = pendientes(movs);
  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  const serv = porServicio(movs, mes);
  const meses = ultimosMeses(mes, 6).map((m) => ({ m, g: resumenMes(movs, m).ganancia }));
  const maxAbs = Math.max(1, ...meses.map((x) => Math.abs(x.g)));
  const comision = perfil.modalidad === "comision";
  const lblVentas = comision ? t("Tus comisiones") : t("Ventas");
  const ingresos = comision ? t("Comisiones") : t("Ventas");
  const anual = resultadoAnual(movs, mes);
  const mesCorto = (m) => nombreMes(m, { month: "short" }).replace(".", "");
  const rango = anual.filas.length > 1 ? `${mesCorto(anual.filas[0].mes)} – ${mesCorto(mes)}` : mesCorto(mes);

  app.innerHTML = `
    <section class="hello">
      <small>${t("Control financiero")}</small>
      <h1>${t("Tus <em>finanzas</em>")}</h1>
    </section>

    <div class="monthbar">
      <button class="btn ghost" id="prev" aria-label="${t("Mes anterior")}">‹</button>
      <h1>${esc(nombreMes(mes))}</h1>
      <button class="btn ghost" id="next" aria-label="${t("Mes siguiente")}">›</button>
    </div>

    <div class="kpis">
      <div class="card kpi main">
        <small>${t("Ganancia estimada del mes")}</small>
        <strong class="${r.ganancia < 0 ? "neg" : ""}">${fmt(r.ganancia)}</strong>
        <div class="sub">${t("{ingresos} − costos − gastos", { ingresos })}${r.margen !== null ? ` · ${t("margen")} ${Math.round(r.margen * 100)}%` : ""}</div>
      </div>
      ${anual.total ? `
      <div class="card kpi acum">
        <div><small>${t("Acumulado")} ${esc(anual.anio)} · ${esc(rango)}</small>
          <strong class="${anual.total.ganancia < 0 ? "neg" : ""}">${fmt(anual.total.ganancia)}</strong></div>
        <div class="acum-det"><span>${ingresos} ${fmt(anual.total.ventas)}</span><span>${t("Costos y gastos")} ${fmt(anual.total.costos + anual.total.gastos)}</span></div>
      </div>` : ""}
      <div class="card kpi"><small>${lblVentas}</small><strong>${fmt(r.ventas)}</strong>
        ${r.facturado > r.ventas ? `<em class="kpi-note">${t("Clientas pagaron {monto}", { monto: fmt(r.facturado) })}</em>` : ""}</div>
      <div class="card kpi"><small>${t("Costos de material")}</small><strong>${fmt(r.costos)}</strong>
        ${perfil.materiales_salon ? `<em class="kpi-note">${t("El salón pone materiales")}</em>` : ""}</div>
      <div class="card kpi"><small>${comision ? t("Tus gastos") : t("Gastos del negocio")}</small><strong>${fmt(r.gastos)}</strong></div>
      <div class="card kpi"><small>${t("Caja del mes")}</small><strong class="${r.caja < 0 ? "neg" : ""}">${fmt(r.caja)}</strong></div>
    </div>

    <div class="quick">
      <button class="btn" data-new="venta">+ ${t("Venta")}</button>
      <button class="btn ghost" data-new="costo">+ ${t("Costo")}</button>
      <button class="btn ghost" data-new="gasto">+ ${t("Gasto")}</button>
    </div>

    ${p.lista.length ? `
    <div class="fh"><h2><em>${t("Pendientes")}</em></h2></div>
    <div class="card">
      <div class="kpis" style="margin-bottom:8px">
        <div class="kpi" style="padding:0"><small>${comision ? t("Te debe el salón / clientas") : t("Te deben")}</small><strong>${fmt(p.porCobrar)}</strong></div>
        <div class="kpi" style="padding:0"><small>${t("Debes pagar")}</small><strong>${fmt(p.porPagar)}</strong></div>
      </div>
      <ul class="list">${p.lista.map((m) => item(m, true)).join("")}</ul>
    </div>` : ""}

    <div class="fh"><h2>${t("Movimientos <em>del mes</em>")}</h2><span class="muted">${delMes.length}</span></div>
    <div class="card">
      ${delMes.length ? `<ul class="list">${delMes.map((m) => item(m)).join("")}</ul>`
        : `<div class="empty">${t("Aún no hay movimientos este mes.")}<br>${t("Empieza registrando tu primera venta.")}</div>`}
    </div>

    ${serv.length ? `
    <div class="fh"><h2>${t("Por <em>servicio</em>")}</h2></div>
    <div class="card serv">
      <table>
        <thead><tr><th>${t("Servicio")}</th><th>${comision ? t("Tu parte") : t("Ventas")}</th><th>${t("Costos")}</th><th>${t("Queda")}</th></tr></thead>
        <tbody>${serv.map((s) => `<tr><td>${esc(s.servicio === "Sin servicio" ? t("Sin servicio") : s.servicio)}</td><td>${fmt(s.ventas)}</td><td>${fmt(s.costos)}</td><td class="${s.ganancia < 0 ? "neg" : ""}">${fmt(s.ganancia)}</td></tr>`).join("")}</tbody>
      </table>
      <p class="muted" style="font-size:.78rem;margin:8px 0 0">${comision ? t("Solo tu parte y materiales del servicio. Los gastos se restan en la ganancia del mes.") : t("Solo ventas y materiales del servicio. Los gastos se restan en la ganancia del mes.")}</p>
    </div>` : ""}

    ${anual.filas.length ? `
    <div class="fh"><h2>${t("Resultado <em>mensual</em>")}</h2><span class="muted">${esc(anual.anio)}</span></div>
    <div class="card anual">
      <div class="tabla-scroll">
        <table>
          <thead><tr><th>${t("Mes")}</th><th>${ingresos}</th><th>${t("Resultado")}</th><th>${t("Acumulado")}</th></tr></thead>
          <tbody>${anual.filas.map((f) => `<tr class="${f.mes === mes ? "actual" : ""}" data-mes="${f.mes}">
            <td>${esc(mesCorto(f.mes))}</td><td>${fmt(f.ventas)}</td>
            <td class="${f.ganancia < 0 ? "neg" : ""}">${fmt(f.ganancia)}</td><td class="${f.acumulado < 0 ? "neg" : ""}"><b>${fmt(f.acumulado)}</b></td></tr>`).join("")}</tbody>
          <tfoot><tr><td>${t("Total")}</td><td>${fmt(anual.total.ventas)}</td>
            <td colspan="2" class="${anual.total.ganancia < 0 ? "neg" : ""}"><b>${fmt(anual.total.ganancia)}</b>${anual.total.margen !== null ? ` <span>· ${t("margen")} ${Math.round(anual.total.margen * 100)}%</span>` : ""}</td></tr></tfoot>
        </table>
      </div>
      <p class="muted" style="font-size:.78rem;margin:8px 0 0">${t("Resultado = {ingresos} − costos − gastos de cada mes.", { ingresos: ingresos.toLowerCase() })} ${t("El acumulado suma los resultados del año hasta el mes que estás viendo. Toca un mes para verlo.")}</p>
    </div>` : ""}

    <div class="fh"><h2>${t("Últimos <em>6 meses</em>")}</h2></div>
    <div class="card">
      <div class="chart" role="img" aria-label="${t("Ganancia estimada de los últimos 6 meses")}">
        ${meses.map((x) => `<div class="col" title="${esc(nombreMes(x.m))}: ${esc(fmt(x.g))}">
          <div class="bar ${x.g < 0 ? "neg" : ""}" style="height:${Math.round((Math.abs(x.g) / maxAbs) * 100)}%"></div>
          <small>${esc(nombreMes(x.m, { month: "short" }))}</small></div>`).join("")}
      </div>
    </div>

    <div class="fh"><h2>${t("Tus <em>datos</em>")}</h2></div>
    <div class="card stack">
      <div class="modo-actual">
        <div><span class="label">${t("Cómo trabajas")}</span>
          <b>${esc(t(MODALIDADES[perfil.modalidad]?.nombre || "Sin definir"))}</b>
          ${perfil.comision_pct ? `<small>${t("Tu comisión: {pct}", { pct: pctTxt(perfil.comision_pct) })}${perfil.materiales_salon ? " · " + t("el salón pone materiales") : ""}</small>` : ""}
        </div>
        <button class="btn ghost small" id="cambiar-modo">${t("Cambiar")}</button>
      </div>
      <div class="row">
        <div class="campo">
          <label for="moneda">${t("Moneda")}</label>
          <select id="moneda">
            <option value="auto" ${monedaManual ? "" : "selected"}>${t("Automática")} · ${monedaDelPais(paisIso)}</option>
            ${MONEDAS.map((c) => `<option value="${c}" ${monedaManual && c === moneda ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div style="display:flex;align-items:flex-end"><button class="btn ghost block" id="export">${t("Descargar Excel (CSV)")}</button></div>
      </div>
    </div>

    <div class="fh"><h2>${t("¿Qué es <em>cada cosa</em>?")}</h2></div>
    <dl class="card help">
      <dt>${t("Venta")}</dt><dd>${t("Lo que vendiste. Si aún no te pagan, márcala como pendiente; cuando te paguen, ábrela y marca “pagado”. No la registres dos veces.")}</dd>
      ${usaComision() ? `<dt>${t("Comisión")}</dt><dd>${t("Si trabajas en un salón, escribe lo que pagó la clienta y tu %. Solo tu parte cuenta como ingreso tuyo; lo que pagó la clienta se muestra aparte.")}</dd>
      <dt>${t("Propina")}</dt><dd>${t("Regístrala como venta con la categoría “Propina”: es 100% tuya, sin comisión.")}</dd>` : ""}
      <dt>${t("Costo")}</dt><dd>${t("Material que usas en tus servicios (esmaltes, tips, decoración).")}${perfil.materiales_salon ? " " + t("Si el salón te los da, no los registres.") : ""}</dd>
      <dt>${t("Gasto")}</dt><dd>${t("Lo que necesitas para trabajar (arriendo, transporte, publicidad, herramientas).")}</dd>
      <dt>${t("Ganancia estimada")}</dt><dd>${t("{ingresos} − costos − gastos del mes, aunque algo esté pendiente de pago.", { ingresos })}</dd>
      <dt>${t("Caja del mes")}</dt><dd>${t("La plata que realmente entró menos la que realmente salió este mes.")}</dd>
      <dt>${t("Acumulado")}</dt><dd>${t("La suma de los resultados de todos los meses del año, hasta el mes que estás viendo. Te dice cuánto llevas ganado en el año.")}</dd>
    </dl>`;

  $("prev").onclick = () => { mes = moverMes(mes, -1); render(); };
  $("next").onclick = () => { mes = moverMes(mes, 1); render(); };
  app.querySelectorAll("[data-new]").forEach((b) => (b.onclick = () => abrir(null, b.dataset.new)));
  app.querySelectorAll("[data-id]").forEach((li) => {
    li.onclick = () => abrir(movs.find((m) => m.id === li.dataset.id));
    li.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); li.click(); } };
  });
  app.querySelectorAll("[data-pay]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); marcarPagado(b.dataset.pay); }));
  $("export").onclick = exportar;
  app.querySelectorAll("tr[data-mes]").forEach((tr) => (tr.onclick = () => { mes = tr.dataset.mes; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }));
  $("cambiar-modo").onclick = () => renderModalidad(false);
  // "Automática" vuelve a la moneda del país; otra opción la deja fija
  $("moneda").onchange = async (e) => {
    const v = e.target.value;
    const cambios = v === "auto" ? { moneda_manual: false } : { moneda: v, moneda_manual: true };
    const { data } = await supabase.from("profiles").update(cambios).eq("id", session.user.id).select("moneda, moneda_manual").single();
    if (data) { moneda = data.moneda; monedaManual = data.moneda_manual; }
    render();
  };
}

function item(m, conAccion = false) {
  const signo = m.tipo === "venta" ? "+" : "−";
  const letra = { venta: "V", costo: "C", gasto: "G" }[m.tipo];
  const com = m.precio_cliente ? t("Clienta pagó {monto} · tu {pct}", { monto: fmt(m.precio_cliente), pct: pctTxt(m.comision_pct) }) : null;
  const detalle = [fechaCorta(m.fecha), com, m.descripcion && m.categoria ? t(m.categoria) : null, m.servicio].filter(Boolean).map(esc).join(" · ");
  return `<li data-id="${esc(m.id)}" tabindex="0">
    <div class="dot ${m.tipo}">${letra}</div>
    <div class="txt"><b>${esc(m.descripcion || (m.categoria ? t(m.categoria) : t(TITULOS[m.tipo])))}${m.estado === "pendiente" && !conAccion ? `<span class="pill">${t("pendiente")}</span>` : ""}</b><span>${detalle}</span></div>
    ${conAccion ? `<button class="btn small" data-pay="${esc(m.id)}">${m.tipo === "venta" ? t("Cobrado") : t("Pagado")}</button>` : ""}
    <div class="amt ${m.tipo}">${signo}${fmt(m.monto)}</div>
  </li>`;
}

// ¿La venta que se está editando es por comisión? (no aplica a propinas)
const enComision = () => form.querySelector("input[name=tipo]:checked").value === "venta"
  && usaComision() && $("f-com").checked && $("f-cat").value !== "Propina";

function hint(tipo) {
  if (tipo === "venta" && enComision()) return t("Escribe lo que pagó la clienta y tu %. Calculamos tu parte.");
  if (tipo === "venta") return $("f-cat").value === "Propina" ? t("La propina es 100% tuya.") : t("Lo que te pagan (o te deben) por un servicio o producto.");
  if (tipo === "costo") return perfil.materiales_salon ? t("El salón pone los materiales: registra solo lo que compras tú.") : t("Material que se usa en un servicio: esmaltes, tips, decoración…");
  return t("Lo que necesitas para trabajar y no es de un servicio puntual: arriendo, transporte, publicidad…");
}

// Muestra u oculta los campos de comisión y calcula la parte de la manicurista
function syncComision() {
  const tipo = form.querySelector("input[name=tipo]:checked").value;
  const esVenta = tipo === "venta";
  $("com-check-wrap").classList.toggle("hidden", !(esVenta && usaComision() && $("f-cat").value !== "Propina"));
  const on = enComision();
  $("com-box").classList.toggle("hidden", !on);
  $("monto-wrap").classList.toggle("hidden", on);
  $("tipo-hint").textContent = hint(tipo);
  if (on) {
    const precio = Number(String($("f-precio").value).replace(",", "."));
    const pct = Number(String($("f-pct").value).replace(",", "."));
    if (precio > 0 && pct > 0 && pct <= 100) {
      const parte = calcularComision(precio, pct);
      $("f-monto").value = parte;
      $("com-result").innerHTML = `${t("Tu parte:")} <b>${esc(fmt(parte))}</b> <span>(${t("{pct} de {precio}", { pct: esc(pctTxt(pct)), precio: esc(fmt(precio)) })})</span>`;
    } else {
      $("com-result").textContent = t("Completa los dos datos para calcular tu parte.");
    }
  }
}

function setTipo(tipo) {
  form.querySelector(`input[name=tipo][value=${tipo}]`).checked = true;
  $("serv-wrap").classList.toggle("hidden", tipo === "gasto");
  $("estado-label").textContent = tipo === "venta" ? (usaComision() && $("f-com").checked ? t("¿Ya te pagaron tu parte?") : t("¿Ya te pagaron?")) : t("¿Ya lo pagaste?");
  const cat = $("f-cat"), actual = cat.value;
  cat.innerHTML = CATEGORIAS[tipo].map((c) => `<option value="${esc(c)}">${esc(t(c))}</option>`).join("");
  if (CATEGORIAS[tipo].includes(actual)) cat.value = actual;
  if (!editId) $("mov-title").textContent = { venta: t("Nueva venta"), costo: t("Nuevo costo de material"), gasto: t("Nuevo gasto") }[tipo];
  syncComision();
}

form.querySelectorAll("input[name=tipo]").forEach((r) => (r.onchange = () => setTipo(r.value)));
$("f-cat").addEventListener("change", syncComision);
$("f-com").addEventListener("change", () => setTipo(form.querySelector("input[name=tipo]:checked").value));
$("f-precio").addEventListener("input", syncComision);
$("f-pct").addEventListener("input", syncComision);

function abrir(m, tipo = "venta") {
  editId = m?.id ?? null;
  $("mov-error").classList.add("hidden");
  $("mov-delete").classList.toggle("hidden", !m);
  $("mov-title").textContent = m ? t("Editar movimiento") : "";
  $("servicios").innerHTML = [...new Set(movs.map((x) => x.servicio).filter(Boolean))].map((s) => `<option value="${esc(s)}">`).join("");
  // Comisión: en edición se respeta lo guardado; en una venta nueva, según cómo trabaja
  $("f-com").checked = m ? Boolean(m.precio_cliente) : perfil.modalidad === "comision";
  $("f-precio").value = m?.precio_cliente ?? "";
  $("f-pct").value = m?.comision_pct ?? perfil.comision_pct ?? "";
  setTipo(m?.tipo ?? tipo);
  $("f-monto").value = m ? m.monto : "";
  $("f-fecha").value = m ? m.fecha : (mes === hoy().slice(0, 7) ? hoy() : mes + "-01");
  $("f-desc").value = m?.descripcion ?? "";
  if (m?.categoria) $("f-cat").value = m.categoria;
  $("f-serv").value = m?.servicio ?? "";
  $("f-estado").value = m?.estado ?? "pagado";
  syncComision();
  dlg.showModal();
  if (!m) (enComision() ? $("f-precio") : $("f-monto")).focus();
}

$("mov-cancel").onclick = () => dlg.close();

form.onsubmit = async (e) => {
  e.preventDefault();
  const tipo = form.querySelector("input[name=tipo]:checked").value;
  const com = enComision();
  let precio_cliente = null, comision_pct = null;
  if (com) {
    precio_cliente = Number(String($("f-precio").value).replace(",", "."));
    comision_pct = Number(String($("f-pct").value).replace(",", "."));
    if (!(precio_cliente > 0)) return error(t("Escribe cuánto pagó la clienta."));
    if (!(comision_pct > 0 && comision_pct <= 100)) return error(t("Escribe tu porcentaje de comisión, entre 1 y 100."));
  }
  const monto = com ? calcularComision(precio_cliente, comision_pct) : Number(String($("f-monto").value).replace(",", "."));
  const fecha = $("f-fecha").value;
  if (!(monto > 0)) return error(t("Escribe un monto mayor a cero."));
  if (!fecha) return error(t("Elige una fecha."));
  const estado = $("f-estado").value;
  const previo = editId ? movs.find((m) => m.id === editId) : null;
  const row = {
    tipo, monto, fecha, estado, precio_cliente, comision_pct,
    descripcion: $("f-desc").value.trim() || null,
    categoria: $("f-cat").value || null,
    servicio: tipo === "gasto" ? null : ($("f-serv").value.trim() || null),
    // Si se marca como pagado ahora, queda registrada la fecha real del pago
    fecha_pago: estado === "pagado" ? (previo?.estado === "pendiente" ? hoy() : (previo?.fecha_pago ?? null)) : null,
  };
  $("mov-save").disabled = true;
  const q = editId
    ? supabase.from("fin_movements").update(row).eq("id", editId).select().single()
    : supabase.from("fin_movements").insert(row).select().single();
  const { data, error: err } = await q;
  $("mov-save").disabled = false;
  if (err) return error(t("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."));
  movs = editId ? movs.map((m) => (m.id === editId ? data : m)) : [data, ...movs];
  movs.sort((a, b) => b.fecha.localeCompare(a.fecha));
  mes = mesDe(data.fecha);
  dlg.close();
  render();
};

$("mov-delete").onclick = async () => {
  if (!editId || !confirm(t("¿Eliminar este movimiento? No se puede deshacer."))) return;
  const { error: err } = await supabase.from("fin_movements").delete().eq("id", editId);
  if (err) return error(t("No se pudo eliminar. Inténtalo de nuevo."));
  movs = movs.filter((m) => m.id !== editId);
  dlg.close();
  render();
};

async function marcarPagado(id) {
  const { data, error: err } = await supabase.from("fin_movements")
    .update({ estado: "pagado", fecha_pago: hoy() }).eq("id", id).select().single();
  if (err) return alert(t("No se pudo actualizar. Inténtalo de nuevo."));
  movs = movs.map((m) => (m.id === id ? data : m));
  render();
}

function error(t) {
  const el = $("mov-error");
  el.textContent = t;
  el.classList.remove("hidden");
}

function exportar() {
  const blob = new Blob([toCSV(movs)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `artlab-finanzas-${hoy()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
