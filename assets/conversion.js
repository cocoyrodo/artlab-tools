// Cambio de moneda con conversión de montos.
// Si la alumna ya tiene movimientos, se le pregunta si quiere convertirlos al
// tipo de cambio de hoy (editable) o solo cambiar la moneda. La conversión la
// hace public.convertir_moneda en la base de datos, en una sola transacción.
import { t, locale } from "/assets/i18n.js?v=20261026j";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const decimales = (m) => (["CLP", "PYG", "COP", "CRC"].includes(m) ? 0 : 2);
const formato = (n, m) => new Intl.NumberFormat(locale(), { style: "currency", currency: m, maximumFractionDigits: decimales(m), minimumFractionDigits: 0 }).format(n);

// Tipo de cambio de hoy: 1 `de` = X `a`. Fuente pública, sin clave (ExchangeRate-API).
async function tipoDeCambio(de, a) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(de)}`);
    const j = await res.json();
    const tasa = j?.result === "success" ? Number(j.rates?.[a]) : NaN;
    return tasa > 0 ? { tasa, fecha: new Date(j.time_last_update_unix * 1000) } : null;
  } catch { return null; }
}

function preguntar({ actual, nueva, cantidad }) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "conv";
    dlg.innerHTML = `
      <form class="stack" method="dialog" novalidate>
        <h2>${t("Cambiar a {moneda}", { moneda: esc(nueva) })}</h2>
        <p class="muted" style="margin:0;font-size:14px;line-height:1.5">${t("Tienes {n} movimientos en {moneda}. ¿Qué quieres hacer con tus montos?", { n: cantidad, moneda: esc(actual) })}</p>
        <label class="card modo"><input type="radio" name="accion" value="convertir" checked>
          <span><b>${t("Convertir mis montos a {moneda}", { moneda: esc(nueva) })}</b><small>${t("Al tipo de cambio de hoy. Puedes ajustarlo.")}</small></span></label>
        <div class="campo conv-tasa">
          <label for="conv-tasa">${t("Tipo de cambio")}</label>
          <div class="conv-fila"><span>1 ${esc(actual)} =</span><input id="conv-tasa" type="number" inputmode="decimal" min="0" step="any"><span>${esc(nueva)}</span></div>
          <small class="help" id="conv-fuente">${t("Buscando el tipo de cambio de hoy…")}</small>
          <small class="help" id="conv-ejemplo"></small>
        </div>
        <label class="card modo"><input type="radio" name="accion" value="solo">
          <span><b>${t("Solo cambiar la moneda")}</b><small>${t("Mis montos ya están en {moneda}; no se modifican.", { moneda: esc(nueva) })}</small></span></label>
        <div class="msg error hidden" id="conv-error"></div>
        <div class="actions"><span style="flex:1"></span>
          <button type="button" class="btn ghost" id="conv-cancelar">${t("Cancelar")}</button>
          <button type="submit" class="btn" id="conv-ok">${t("Aplicar")}</button></div>
      </form>`;
    document.body.appendChild(dlg);
    const $ = (s) => dlg.querySelector(s);
    const cerrar = (valor) => { dlg.close(); dlg.remove(); resolve(valor); };

    const ejemplo = () => {
      const tasa = Number(String($("#conv-tasa").value).replace(",", "."));
      $("#conv-ejemplo").textContent = tasa > 0 ? t("Ejemplo: {de} → {a}", { de: formato(50, actual), a: formato(50 * tasa, nueva) }) : "";
    };
    const sync = () => {
      const convertir = $("input[name=accion]:checked").value === "convertir";
      $(".conv-tasa").classList.toggle("hidden", !convertir);
    };
    dlg.querySelectorAll("input[name=accion]").forEach((r) => (r.onchange = sync));
    $("#conv-tasa").oninput = ejemplo;
    $("#conv-cancelar").onclick = () => cerrar(null);
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); cerrar(null); });
    $("form").onsubmit = (e) => {
      e.preventDefault();
      if ($("input[name=accion]:checked").value === "solo") return cerrar({ tasa: null });
      const tasa = Number(String($("#conv-tasa").value).replace(",", "."));
      if (!(tasa > 0)) { $("#conv-error").textContent = t("Escribe el tipo de cambio."); $("#conv-error").classList.remove("hidden"); return; }
      cerrar({ tasa });
    };

    dlg.showModal();
    tipoDeCambio(actual, nueva).then((r) => {
      if (!dlg.isConnected) return;
      if (r) {
        $("#conv-tasa").value = Number(r.tasa.toPrecision(6));
        $("#conv-fuente").textContent = t("Tipo de cambio de hoy ({fecha}), según ExchangeRate-API.", { fecha: r.fecha.toLocaleDateString(locale()) });
      } else {
        $("#conv-fuente").textContent = t("No pudimos traer el tipo de cambio de hoy. Escríbelo tú.");
      }
      ejemplo();
    });
  });
}

// Cambia la moneda de la alumna. `manual` = false deja la opción "Automática".
// Devuelve la moneda final, o null si canceló o falló.
export async function cambiarMoneda(supabase, { actual, nueva, manual }) {
  let tasa = null;
  if (nueva !== actual) {
    const { count } = await supabase.from("fin_movements").select("id", { count: "exact", head: true });
    if (count > 0) {
      const r = await preguntar({ actual, nueva, cantidad: count });
      if (!r) return null;
      tasa = r.tasa;
    }
  }
  const { error } = await supabase.rpc("convertir_moneda", { p_moneda: nueva, p_tasa: tasa, p_manual: manual });
  if (error) { alert(t("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.")); return null; }
  return nueva;
}
