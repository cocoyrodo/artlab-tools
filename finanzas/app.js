import { supabase, withSession, esc } from "/assets/auth.js?v=20261026c";
import { renderShell } from "/assets/shell.js?v=20261026c";
import { resumenMes, pendientes, porServicio, ultimosMeses, moverMes, mesDe, toCSV } from "./calc.js?v=20261026c";

const root = document.getElementById("root");
let app; // contenedor de la vista, dentro de la estructura común
const dlg = document.getElementById("mov-dialog");
const form = document.getElementById("mov-form");
const $ = (id) => document.getElementById(id);

const CATEGORIAS = {
  venta: ["Servicio", "Producto", "Curso / clase", "Otro"],
  costo: ["Esmaltes y geles", "Uñas / tips", "Decoración", "Desechables", "Otro material"],
  gasto: ["Arriendo", "Luz / agua / internet", "Publicidad", "Transporte", "Herramientas / equipos", "Capacitación", "Comisiones / bancos", "Otro"],
};
const HINTS = {
  venta: "Lo que te pagan (o te deben) por un servicio o producto.",
  costo: "Material que se usa en un servicio: esmaltes, tips, decoración…",
  gasto: "Gastos del negocio que no son de un servicio puntual: arriendo, publicidad…",
};
const TITULOS = { venta: "venta", costo: "costo de material", gasto: "gasto" };

let session, movs = [], moneda = "CLP";
let mes = new Date().toISOString().slice(0, 7);
let editId = null;

const hoy = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const fmt = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: moneda, maximumFractionDigits: moneda === "CLP" ? 0 : 2 }).format(n || 0);
const nombreMes = (m, opts = { month: "long", year: "numeric" }) => {
  const t = new Date(m + "-15T12:00:00").toLocaleDateString("es-CL", opts);
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const fechaCorta = (f) => new Date(f + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });

withSession(root, async (s) => {
  session = s;
  app = renderShell(root, { active: "finanzas", session: s });
  app.innerHTML = `<p class="muted center" style="margin-top:40px">Cargando tus datos…</p>`;
  await cargar();
}, { title: "Entra a tu control financiero" });

supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.href = "/"; });

async function cargar() {
  const [{ data: perfil }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("moneda").eq("id", session.user.id).maybeSingle(),
    supabase.from("fin_movements").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(10000),
  ]);
  if (error) {
    app.innerHTML = `<div class="msg error" style="margin-top:24px">No pudimos cargar tus datos. Revisa tu conexión y recarga la página.</div>`;
    return;
  }
  if (perfil?.moneda) moneda = perfil.moneda;
  movs = data;
  render();
}

function render() {
  const r = resumenMes(movs, mes);
  const p = pendientes(movs);
  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  const serv = porServicio(movs, mes);
  const meses = ultimosMeses(mes, 6).map((m) => ({ m, g: resumenMes(movs, m).ganancia }));
  const maxAbs = Math.max(1, ...meses.map((x) => Math.abs(x.g)));

  app.innerHTML = `
    <section class="hello">
      <small>Control financiero</small>
      <h1>Tus <em>finanzas</em></h1>
    </section>

    <div class="monthbar">
      <button class="btn ghost" id="prev" aria-label="Mes anterior">‹</button>
      <h1>${esc(nombreMes(mes))}</h1>
      <button class="btn ghost" id="next" aria-label="Mes siguiente">›</button>
    </div>

    <div class="kpis">
      <div class="card kpi main">
        <small>Ganancia estimada del mes</small>
        <strong class="${r.ganancia < 0 ? "neg" : ""}">${fmt(r.ganancia)}</strong>
        <div class="sub">Ventas − costos − gastos${r.margen !== null ? ` · margen ${Math.round(r.margen * 100)}%` : ""}</div>
      </div>
      <div class="card kpi"><small>Ventas</small><strong>${fmt(r.ventas)}</strong></div>
      <div class="card kpi"><small>Costos de material</small><strong>${fmt(r.costos)}</strong></div>
      <div class="card kpi"><small>Gastos del negocio</small><strong>${fmt(r.gastos)}</strong></div>
      <div class="card kpi"><small>Caja del mes</small><strong class="${r.caja < 0 ? "neg" : ""}">${fmt(r.caja)}</strong></div>
    </div>

    <div class="quick">
      <button class="btn" data-new="venta">+ Venta</button>
      <button class="btn ghost" data-new="costo">+ Costo</button>
      <button class="btn ghost" data-new="gasto">+ Gasto</button>
    </div>

    ${p.lista.length ? `
    <div class="fh"><h2><em>Pendientes</em></h2></div>
    <div class="card">
      <div class="kpis" style="margin-bottom:8px">
        <div class="kpi" style="padding:0"><small>Te deben</small><strong>${fmt(p.porCobrar)}</strong></div>
        <div class="kpi" style="padding:0"><small>Debes pagar</small><strong>${fmt(p.porPagar)}</strong></div>
      </div>
      <ul class="list">${p.lista.map((m) => item(m, true)).join("")}</ul>
    </div>` : ""}

    <div class="fh"><h2>Movimientos <em>del mes</em></h2><span class="muted">${delMes.length}</span></div>
    <div class="card">
      ${delMes.length ? `<ul class="list">${delMes.map((m) => item(m)).join("")}</ul>`
        : `<div class="empty">Aún no hay movimientos este mes.<br>Empieza registrando tu primera venta.</div>`}
    </div>

    ${serv.length ? `
    <div class="fh"><h2>Por <em>servicio</em></h2></div>
    <div class="card serv">
      <table>
        <thead><tr><th>Servicio</th><th>Ventas</th><th>Costos</th><th>Queda</th></tr></thead>
        <tbody>${serv.map((s) => `<tr><td>${esc(s.servicio)}</td><td>${fmt(s.ventas)}</td><td>${fmt(s.costos)}</td><td class="${s.ganancia < 0 ? "neg" : ""}">${fmt(s.ganancia)}</td></tr>`).join("")}</tbody>
      </table>
      <p class="muted" style="font-size:.78rem;margin:8px 0 0">Solo ventas y materiales del servicio. Los gastos del negocio se restan en la ganancia del mes.</p>
    </div>` : ""}

    <div class="fh"><h2>Últimos <em>6 meses</em></h2></div>
    <div class="card">
      <div class="chart" role="img" aria-label="Ganancia estimada de los últimos 6 meses">
        ${meses.map((x) => `<div class="col" title="${esc(nombreMes(x.m))}: ${esc(fmt(x.g))}">
          <div class="bar ${x.g < 0 ? "neg" : ""}" style="height:${Math.round((Math.abs(x.g) / maxAbs) * 100)}%"></div>
          <small>${esc(nombreMes(x.m, { month: "short" }))}</small></div>`).join("")}
      </div>
    </div>

    <div class="fh"><h2>Tus <em>datos</em></h2></div>
    <div class="card stack">
      <div class="row">
        <div class="campo">
          <label for="moneda">Moneda</label>
          <select id="moneda">${["CLP", "MXN", "COP", "PEN", "ARS", "USD", "EUR"].map((c) => `<option ${c === moneda ? "selected" : ""}>${c}</option>`).join("")}</select>
        </div>
        <div style="display:flex;align-items:flex-end"><button class="btn ghost block" id="export">Descargar Excel (CSV)</button></div>
      </div>
    </div>

    <div class="fh"><h2>¿Qué es <em>cada cosa</em>?</h2></div>
    <dl class="card help">
      <dt>Venta</dt><dd>Lo que vendiste. Si aún no te pagan, márcala como pendiente; cuando te paguen, ábrela y marca “pagado”. No la registres dos veces.</dd>
      <dt>Costo</dt><dd>Material que usas en tus servicios (esmaltes, tips, decoración).</dd>
      <dt>Gasto</dt><dd>Lo que necesita tu negocio para funcionar (arriendo, publicidad, transporte).</dd>
      <dt>Ganancia estimada</dt><dd>Ventas − costos − gastos del mes, aunque algo esté pendiente de pago.</dd>
      <dt>Caja del mes</dt><dd>La plata que realmente entró menos la que realmente salió este mes.</dd>
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
  $("moneda").onchange = async (e) => {
    moneda = e.target.value;
    await supabase.from("profiles").update({ moneda }).eq("id", session.user.id);
    render();
  };
}

function item(m, conAccion = false) {
  const signo = m.tipo === "venta" ? "+" : "−";
  const letra = { venta: "V", costo: "C", gasto: "G" }[m.tipo];
  const detalle = [fechaCorta(m.fecha), m.descripcion ? m.categoria : null, m.servicio].filter(Boolean).map(esc).join(" · ");
  return `<li data-id="${esc(m.id)}" tabindex="0">
    <div class="dot ${m.tipo}">${letra}</div>
    <div class="txt"><b>${esc(m.descripcion || m.categoria || TITULOS[m.tipo])}${m.estado === "pendiente" && !conAccion ? `<span class="pill">pendiente</span>` : ""}</b><span>${detalle}</span></div>
    ${conAccion ? `<button class="btn small" data-pay="${esc(m.id)}">${m.tipo === "venta" ? "Cobrado" : "Pagado"}</button>` : ""}
    <div class="amt ${m.tipo}">${signo}${fmt(m.monto)}</div>
  </li>`;
}

function setTipo(tipo) {
  form.querySelector(`input[name=tipo][value=${tipo}]`).checked = true;
  $("tipo-hint").textContent = HINTS[tipo];
  $("serv-wrap").classList.toggle("hidden", tipo === "gasto");
  $("estado-label").textContent = tipo === "venta" ? "¿Ya te pagaron?" : "¿Ya lo pagaste?";
  const cat = $("f-cat"), actual = cat.value;
  cat.innerHTML = CATEGORIAS[tipo].map((c) => `<option>${esc(c)}</option>`).join("");
  if (CATEGORIAS[tipo].includes(actual)) cat.value = actual;
  if (!editId) $("mov-title").textContent = `Nuevo ${tipo === "venta" ? "venta" : TITULOS[tipo]}`.replace("Nuevo venta", "Nueva venta");
}

form.querySelectorAll("input[name=tipo]").forEach((r) => (r.onchange = () => setTipo(r.value)));

function abrir(m, tipo = "venta") {
  editId = m?.id ?? null;
  $("mov-error").classList.add("hidden");
  $("mov-delete").classList.toggle("hidden", !m);
  $("mov-title").textContent = m ? "Editar movimiento" : "";
  $("servicios").innerHTML = [...new Set(movs.map((x) => x.servicio).filter(Boolean))].map((s) => `<option value="${esc(s)}">`).join("");
  setTipo(m?.tipo ?? tipo);
  $("f-monto").value = m ? m.monto : "";
  $("f-fecha").value = m ? m.fecha : (mes === hoy().slice(0, 7) ? hoy() : mes + "-01");
  $("f-desc").value = m?.descripcion ?? "";
  if (m?.categoria) $("f-cat").value = m.categoria;
  $("f-serv").value = m?.servicio ?? "";
  $("f-estado").value = m?.estado ?? "pagado";
  dlg.showModal();
  if (!m) $("f-monto").focus();
}

$("mov-cancel").onclick = () => dlg.close();

form.onsubmit = async (e) => {
  e.preventDefault();
  const tipo = form.querySelector("input[name=tipo]:checked").value;
  const monto = Number(String($("f-monto").value).replace(",", "."));
  const fecha = $("f-fecha").value;
  if (!(monto > 0)) return error("Escribe un monto mayor a cero.");
  if (!fecha) return error("Elige una fecha.");
  const estado = $("f-estado").value;
  const previo = editId ? movs.find((m) => m.id === editId) : null;
  const row = {
    tipo, monto, fecha, estado,
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
  if (err) return error("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
  movs = editId ? movs.map((m) => (m.id === editId ? data : m)) : [data, ...movs];
  movs.sort((a, b) => b.fecha.localeCompare(a.fecha));
  mes = mesDe(data.fecha);
  dlg.close();
  render();
};

$("mov-delete").onclick = async () => {
  if (!editId || !confirm("¿Eliminar este movimiento? No se puede deshacer.")) return;
  const { error: err } = await supabase.from("fin_movements").delete().eq("id", editId);
  if (err) return error("No se pudo eliminar. Inténtalo de nuevo.");
  movs = movs.filter((m) => m.id !== editId);
  dlg.close();
  render();
};

async function marcarPagado(id) {
  const { data, error: err } = await supabase.from("fin_movements")
    .update({ estado: "pagado", fecha_pago: hoy() }).eq("id", id).select().single();
  if (err) return alert("No se pudo actualizar. Inténtalo de nuevo.");
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
