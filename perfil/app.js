// Perfil de la alumna, con la misma estructura que el Perfil de la App ART LAB:
// Cuenta, Preferencias, Soporte y legal, y Cerrar sesión. Cada fila abre su
// propia pantalla (#datos, #correo, #clave, #idioma, #moneda, #notificaciones).
import { supabase, withSession, esc, PAISES, paisProbable, errorClave, traducir } from "/assets/auth.js?v=20261026j";
import { renderShell, iniciales } from "/assets/shell.js?v=20261026j";
import { t, lang, LANGS, setLang, nombrePais, alTraducir } from "/assets/i18n.js?v=20261026j";
import { MONEDAS, monedaDelPais, nombreMoneda } from "/assets/monedas.js?v=20261026j";
import { cambiarMoneda } from "/assets/conversion.js?v=20261026j";

const root = document.getElementById("root");
let app, session, perfil = {};
const $ = (id) => document.getElementById(id);

const AYUDA = "https://wa.me/56977617665?text=" + encodeURIComponent("Hola ART LAB 🩷 necesito ayuda con mi cuenta de ART LAB Tools.");
const TERMINOS = "https://artcocoyrodo.com/art-lab-terminos-y-condiciones/";
const PRIVACIDAD = "https://artcocoyrodo.com/privacidad/";
const MODALIDADES = { independiente: "Independiente", comision: "Por comisión en un salón", arriendo: "Arriendo un espacio o silla", otro: "Otro / mixto" };

const ICO = {
  datos: `<svg viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.2"/><path d="M3.5 17c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/></svg>`,
  correo: `<svg viewBox="0 0 20 20"><rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M3 6l7 5 7-5"/></svg>`,
  clave: `<svg viewBox="0 0 20 20"><rect x="4" y="9" width="12" height="8" rx="2"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9"/></svg>`,
  trabajo: `<svg viewBox="0 0 20 20"><rect x="3" y="6" width="14" height="10" rx="2"/><path d="M7.5 6V4.5h5V6M3 10.5h14"/></svg>`,
  idioma: `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/><path d="M10 2.5c2.5 2 2.5 13 0 15M10 2.5c-2.5 2-2.5 13 0 15M2.7 10h14.6"/></svg>`,
  moneda: `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/><path d="M12.5 7.2c-.6-.8-1.5-1.2-2.6-1.2-1.4 0-2.4.8-2.4 1.9 0 2.6 5.2 1.4 5.2 4.1 0 1.1-1.1 2-2.6 2-1.2 0-2.2-.5-2.8-1.4M10 4.5V6M10 14v1.5"/></svg>`,
  notif: `<svg viewBox="0 0 20 20"><path d="M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13z"/><path d="M8.5 17a1.5 1.5 0 0 0 3 0"/></svg>`,
  ayuda: `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/><path d="M7.8 7.8a2.3 2.3 0 0 1 4.4.8c0 1.6-2.2 1.9-2.2 3.4M10 14.6h.01"/></svg>`,
  terminos: `<svg viewBox="0 0 20 20"><path d="M5.5 2.5h6l3.5 3.5v11.5h-9.5z"/><path d="M11.5 2.5V6H15M8 10h5M8 13h5"/></svg>`,
  privacidad: `<svg viewBox="0 0 20 20"><path d="M10 2.5l6 2.5v4.5c0 4-2.6 6.7-6 8-3.4-1.3-6-4-6-8V5z"/></svg>`,
};

// ig***co@gmail.com, como en la App
const ocultarCorreo = (email = "") => {
  const [u, d] = email.split("@");
  if (!d) return email;
  return u.length <= 4 ? `${u[0]}***@${d}` : `${u.slice(0, 2)}***${u.slice(-2)}@${d}`;
};

withSession(root, async (s) => {
  session = s;
  app = renderShell(root, { active: "perfil", session: s });
  document.title = `${t("Perfil")} · ART LAB Tools`;
  const { data } = await supabase.from("profiles").select("*").eq("id", s.user.id).maybeSingle();
  perfil = data || {};
  window.addEventListener("hashchange", pintar);
  // Traducciones nuevas: se repinta solo el menú, nunca un formulario a medio llenar
  alTraducir(() => { if (!location.hash.slice(1)) pintar(); });
  pintar();
}, { title: t("Entra a ART LAB Tools") });

supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.href = "/"; });

function pintar() {
  const vista = location.hash.slice(1);
  const vistas = { datos: vistaDatos, correo: vistaCorreo, clave: vistaClave, idioma: vistaIdioma, moneda: vistaMoneda, notificaciones: vistaNotificaciones };
  (vistas[vista] || vistaPrincipal)();
  window.scrollTo(0, 0);
}

const cabecera = (titulo, volver = "#") => `
  <div class="fh acct-head"><a class="back" href="${volver}" aria-label="${t("Volver")}">←</a><h2>${titulo}</h2></div>`;

const fila = ({ href, ico, titulo, sub, externo }) => `
  <a class="acct-row" href="${href}" ${externo ? 'target="_blank" rel="noopener noreferrer"' : ""}>
    <div class="acct-ico">${ICO[ico]}</div>
    <div class="acct-info"><div class="acct-t">${titulo}</div>${sub ? `<div class="acct-s">${sub}</div>` : ""}</div>
    <div class="acct-arr">${externo ? "↗" : "›"}</div>
  </a>`;

function vistaPrincipal() {
  const nombre = perfil.nombre || session.user.user_metadata?.nombre || t("Alumna");
  const idioma = LANGS.find(([c]) => c === lang)?.[1];
  app.innerHTML = `
    ${cabecera(t("Perfil"), "/")}
    <div class="acct-hero">
      <div class="acct-avatar">${esc(iniciales(session).slice(0, 1))}</div>
      <div class="acct-hero-body">
        <div class="acct-hero-name">${esc(nombre)}</div>
        <div class="acct-hero-email">${esc(ocultarCorreo(session.user.email))}</div>
      </div>
    </div>

    <div class="acct-slbl">${t("Cuenta")}</div>
    <div class="acct-card">
      ${fila({ href: "#datos", ico: "datos", titulo: t("Datos personales") })}
      ${fila({ href: "#correo", ico: "correo", titulo: t("Correo electrónico") })}
      ${fila({ href: "#clave", ico: "clave", titulo: t("Contraseña") })}
      ${fila({ href: "/finanzas/?modo", ico: "trabajo", titulo: t("Mi forma de trabajo"), sub: perfil.modalidad ? esc(t(MODALIDADES[perfil.modalidad])) : "" })}
    </div>

    <div class="acct-slbl">${t("Preferencias")}</div>
    <div class="acct-card">
      ${fila({ href: "#idioma", ico: "idioma", titulo: t("Idioma"), sub: esc(idioma) })}
      ${fila({ href: "#moneda", ico: "moneda", titulo: t("Moneda"), sub: esc(perfil.moneda || "CLP") + (perfil.moneda_manual ? "" : " · " + t("automática")) })}
      ${fila({ href: "#notificaciones", ico: "notif", titulo: t("Notificaciones") })}
    </div>

    <div class="acct-slbl">${t("Soporte y legal")}</div>
    <div class="acct-card">
      ${fila({ href: AYUDA, ico: "ayuda", titulo: t("Ayuda"), externo: true })}
      ${fila({ href: TERMINOS, ico: "terminos", titulo: t("Términos y condiciones"), externo: true })}
      ${fila({ href: PRIVACIDAD, ico: "privacidad", titulo: t("Política de privacidad"), externo: true })}
    </div>

    <button type="button" class="acct-logout" id="salir">${t("Cerrar sesión")}</button>`;

  $("salir").onclick = async () => {
    if (!confirm(t("¿Cerrar sesión?"))) return;
    await supabase.auth.signOut();
    location.href = "/";
  };
}

// Formulario genérico de una sub-pantalla, con mensaje de éxito o error
function formulario(titulo, campos, alGuardar, { boton = t("Guardar"), nota = "" } = {}) {
  app.innerHTML = `
    ${cabecera(titulo)}
    <form class="card stack" id="f" novalidate>
      ${nota ? `<p class="muted" style="margin:0;font-size:13px;line-height:1.5">${nota}</p>` : ""}
      ${campos}
      <div class="msg hidden" id="f-msg" role="status"></div>
      <button class="btn block" type="submit">${boton}</button>
    </form>`;
  const msg = (texto, tipo) => { const el = $("f-msg"); el.className = "msg " + tipo; el.textContent = texto; };
  $("f").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("f").querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const ok = await alGuardar(msg);
      if (ok) msg(ok, "info");
    } catch (err) {
      msg(err?.visible || traducir(err), "error");
    }
    btn.disabled = false;
  };
}
const falla = (texto) => Object.assign(new Error(texto), { visible: texto });

function vistaDatos() {
  const isoActual = perfil.pais_iso || paisProbable();
  const opciones = PAISES.map(([iso, dial, n]) => [iso, dial, n, nombrePais(iso, n)]).sort((a, b) => a[3].localeCompare(b[3], lang))
    .map(([iso, dial, n, visible]) => `<option value="${n}" data-iso="${iso}" data-dial="${dial}" ${iso === isoActual ? "selected" : ""}>${esc(visible)}</option>`).join("");
  formulario(t("Datos personales"), `
    <div class="campo"><label for="p-nombre">${t("Nombre")}</label><input id="p-nombre" autocomplete="name" maxlength="80" value="${esc(perfil.nombre || "")}"></div>
    <div class="campo"><label for="p-social">${t("Tu cuenta de Instagram o Facebook")}</label><input id="p-social" autocapitalize="off" maxlength="80" placeholder="${t("@tucuenta")}" value="${esc(perfil.red_social || "")}"></div>
    <div class="campo"><label for="p-pais">${t("País")}</label>
      <select id="p-pais"><option value="" ${isoActual ? "" : "selected"} disabled>${t("Elige tu país")}</option>${opciones}
        <option value="Otro país" data-iso="" data-dial="" ${perfil.pais === "Otro país" ? "selected" : ""}>${t("Otro país")}</option></select></div>
    <div class="campo"><label for="p-tel">WhatsApp</label><input id="p-tel" type="tel" autocomplete="tel" maxlength="32" value="${esc(perfil.whatsapp || "")}"></div>`,
  async () => {
    const nombre = $("p-nombre").value.trim();
    if (!nombre) throw falla(t("Escribe tu nombre."));
    const opt = $("p-pais").selectedOptions[0];
    const cambios = {
      nombre,
      red_social: $("p-social").value.trim() || null,
      pais: $("p-pais").value || null,
      pais_iso: opt?.dataset.iso || null,
      whatsapp: $("p-tel").value.trim() || null,
    };
    // Si cambia el país, la base de datos ajusta la moneda (salvo que la eligiera a mano)
    const { data, error } = await supabase.from("profiles").update(cambios).eq("id", session.user.id).select().single();
    if (error) throw falla(t("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."));
    // El nombre también vive en la cuenta: se usa para el saludo y las iniciales
    await supabase.auth.updateUser({ data: { nombre } });
    Object.assign(perfil, data || cambios);
    return t("Tus datos quedaron guardados.");
  });
}

function vistaCorreo() {
  formulario(t("Correo electrónico"), `
    <div class="campo"><label>${t("Correo actual")}</label><input value="${esc(session.user.email)}" disabled></div>
    <div class="campo"><label for="p-email">${t("Correo nuevo")}</label><input id="p-email" type="email" autocomplete="email" autocapitalize="off" inputmode="email" placeholder="${t("tu@correo.com")}"></div>`,
  async () => {
    const email = $("p-email").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw falla(t("Escribe un correo válido."));
    if (email === session.user.email) throw falla(t("Ese ya es tu correo actual."));
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: location.origin + "/perfil/" });
    if (error) throw error;
    return t("Te enviamos un enlace de confirmación. El cambio se aplica cuando lo confirmes desde tu correo.");
  }, { boton: t("Cambiar correo") });
}

function vistaClave() {
  formulario(t("Contraseña"), `
    <div class="campo"><label for="p-pass">${t("Crea tu nueva contraseña")}</label><input id="p-pass" type="password" autocomplete="new-password" maxlength="72" placeholder="${t("Mínimo 8 caracteres")}">
      <small class="help">${t("8 a 72 caracteres: mayúscula, minúscula, número y símbolo.")}</small></div>
    <div class="campo"><label for="p-pass2">${t("Repite la contraseña")}</label><input id="p-pass2" type="password" autocomplete="new-password" maxlength="72"></div>`,
  async () => {
    const pass = $("p-pass").value;
    const problema = errorClave(pass);
    if (problema) throw falla(problema);
    if (pass !== $("p-pass2").value) throw falla(t("Las contraseñas no coinciden."));
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) throw error;
    $("p-pass").value = $("p-pass2").value = "";
    return t("Tu contraseña quedó actualizada.");
  }, { boton: t("Guardar contraseña") });
}

// Lista de opciones con check, como "Idioma" en la App
function vistaOpciones(titulo, opciones, actual, alElegir) {
  app.innerHTML = `
    ${cabecera(titulo)}
    <div class="acct-card">
      ${opciones.map(([valor, texto, sub]) => `
        <button type="button" class="acct-opt ${valor === actual ? "on" : ""}" data-v="${esc(valor)}">
          <span><b>${esc(texto)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span><span class="acct-opt-check"></span>
        </button>`).join("")}
    </div>
    <div class="msg hidden" id="f-msg" role="status" style="margin-top:12px"></div>`;
  app.querySelectorAll(".acct-opt").forEach((b) => (b.onclick = async () => {
    app.querySelectorAll(".acct-opt").forEach((x) => x.classList.toggle("on", x === b));
    const res = await alElegir(b.dataset.v);
    if (res) { const el = $("f-msg"); el.className = "msg " + res[1]; el.textContent = res[0]; }
  }));
}

function vistaIdioma() {
  vistaOpciones(t("Idioma"), LANGS.map(([c, n]) => [c, n, c.toUpperCase()]), lang, async (nuevo) => {
    if (nuevo === lang) return null;
    await supabase.auth.updateUser({ data: { lang: nuevo } }).catch(() => {});
    setLang(nuevo);
    return null;
  });
}

// "Automática" usa la moneda del país; elegir otra la deja fija (moneda_manual)
function vistaMoneda() {
  const delPais = monedaDelPais(perfil.pais_iso);
  const opciones = [["auto", t("Automática"), t("Según tu país: {moneda}", { moneda: `${delPais} · ${nombreMoneda(delPais)}` })],
    ...MONEDAS.map((c) => [c, c, nombreMoneda(c)])];
  vistaOpciones(t("Moneda"), opciones, perfil.moneda_manual ? perfil.moneda : "auto", async (v) => {
    // Si la moneda cambia y hay movimientos, pregunta si convertirlos al tipo de cambio
    const nueva = v === "auto" ? delPais : v;
    const final = await cambiarMoneda(supabase, { actual: perfil.moneda || "CLP", nueva, manual: v !== "auto" });
    if (!final) { vistaMoneda(); return null; }
    Object.assign(perfil, { moneda: final, moneda_manual: v !== "auto" });
    return [t("Listo. Tus montos se mostrarán en {moneda}.", { moneda: final }), "info"];
  });
}

function vistaNotificaciones() {
  vistaOpciones(t("Notificaciones"), [
    ["si", t("Sí, quiero recibir novedades"), t("Guías nuevas y novedades de ART LAB por correo o WhatsApp.")],
    ["no", t("No por ahora"), t("Solo recibirás correos de tu cuenta, como confirmaciones o cambio de contraseña.")],
  ], perfil.acepta_novedades ? "si" : "no", async (v) => {
    const acepta = v === "si";
    const cambios = { acepta_novedades: acepta, acepta_novedades_at: acepta ? new Date().toISOString() : null };
    const { error } = await supabase.from("profiles").update(cambios).eq("id", session.user.id);
    if (error) return [t("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."), "error"];
    Object.assign(perfil, cambios);
    return [acepta ? t("Listo. Te avisaremos de las novedades.") : t("Listo. Ya no recibirás novedades."), "info"];
  });
}
