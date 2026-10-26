// Sesión compartida por todas las herramientas de ART LAB Tools.
// Solo usa la clave pública (publishable/anon) de Supabase: la seguridad
// de los datos la garantiza Row Level Security en la base de datos.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SITE_URL } from "/assets/config.js?v=20261026d";

// Se lee antes de crear el cliente, porque el cliente limpia el hash al procesarlo
const IS_RECOVERY = location.hash.includes("type=recovery");

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Misma lista y prefijos que el registro de la App ART LAB
const PAISES = [
  ["AR", "+54", "Argentina"], ["BO", "+591", "Bolivia"], ["BR", "+55", "Brasil"], ["CA", "+1", "Canadá"],
  ["CL", "+56", "Chile"], ["CO", "+57", "Colombia"], ["CR", "+506", "Costa Rica"], ["CU", "+53", "Cuba"],
  ["EC", "+593", "Ecuador"], ["SV", "+503", "El Salvador"], ["ES", "+34", "España"], ["US", "+1", "Estados Unidos"],
  ["FR", "+33", "Francia"], ["GT", "+502", "Guatemala"], ["HN", "+504", "Honduras"], ["IT", "+39", "Italia"],
  ["MX", "+52", "México"], ["NI", "+505", "Nicaragua"], ["PA", "+507", "Panamá"], ["PY", "+595", "Paraguay"],
  ["PE", "+51", "Perú"], ["PT", "+351", "Portugal"], ["PR", "+1", "Puerto Rico"], ["GB", "+44", "Reino Unido"],
  ["DO", "+1", "República Dominicana"], ["CH", "+41", "Suiza"], ["UY", "+598", "Uruguay"], ["VE", "+58", "Venezuela"],
];

// País probable según la zona horaria del dispositivo (sin llamar a servicios externos)
const ZONAS = {
  Santiago: "CL", Punta_Arenas: "CL", Buenos_Aires: "AR", Cordoba: "AR", Mendoza: "AR", La_Paz: "BO", Sao_Paulo: "BR",
  Bogota: "CO", Costa_Rica: "CR", Havana: "CU", Guayaquil: "EC", El_Salvador: "SV", Madrid: "ES", Paris: "FR",
  Guatemala: "GT", Tegucigalpa: "HN", Rome: "IT", Mexico_City: "MX", Monterrey: "MX", Cancun: "MX", Tijuana: "MX",
  Managua: "NI", Panama: "PA", Asuncion: "PY", Lima: "PE", Lisbon: "PT", Puerto_Rico: "PR", London: "GB",
  Santo_Domingo: "DO", Zurich: "CH", Montevideo: "UY", Caracas: "VE",
};
function paisProbable() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return ZONAS[tz.split("/").pop()] || "";
  } catch { return ""; }
}

// Misma política de contraseñas que la App ART LAB
function errorContrasena(p) {
  if (p.length < 8 || p.length > 72) return "Usa entre 8 y 72 caracteres, con al menos una mayúscula, una minúscula, un número y un símbolo.";
  const falta = [];
  if (!/[a-z]/.test(p)) falta.push("una letra minúscula");
  if (!/[A-Z]/.test(p)) falta.push("una letra mayúscula");
  if (!/[0-9]/.test(p)) falta.push("un número");
  if (!/[^a-zA-Z0-9]/.test(p)) falta.push("un símbolo (por ejemplo, ! o @)");
  if (falta.length) return "Contraseña débil. Le falta: " + falta.join(", ") + ".";
  const simple = p.toLowerCase().replace(/[^a-z0-9ñ]/g, "");
  if (/^(?:pass(?:word)?|contrase[nñ]a|qwerty|admin|welcome|bienvenid[ao]|abc)\d{0,6}$/.test(simple)) return "Contraseña débil: es demasiado común y fácil de adivinar.";
  return "";
}

const OJO = `<button type="button" class="pwd-toggle" aria-label="Mostrar contraseña"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>`;

// Pantalla de ingreso / registro / recuperación, con el diseño del login de la App ART LAB.
// Llama a onReady(session) al entrar.
export function renderAuth(container, { title = "Entra a ART LAB Tools", onReady, initialMode = "login" } = {}) {
  let mode = initialMode;

  const draw = (notice = "", kind = "info") => {
    const isLogin = mode === "login", isSignup = mode === "signup", isReset = mode === "reset", isNewPass = mode === "newpass";
    const nuevaClave = isSignup || isNewPass;
    container.innerHTML = `
      <div class="login-page">
        <div class="deco-circle"></div><div class="deco-circle small"></div>
        <header class="login-header">
          <a href="/"><img src="/assets/brand/logo-pink-black.webp" alt="Cocó & Rodo — ART LAB"></a>
          <p class="login-frase">Herramientas para tu negocio.<br>Organiza, crece y disfruta tu arte.</p>
        </header>
        <div class="login-card">
          <h2>${isSignup ? "Crea tu cuenta" : isReset ? "Recupera tu contraseña" : isNewPass ? "Crea tu nueva contraseña" : esc(title)}</h2>
          <p class="lead">${isSignup ? "Una sola cuenta para todas las herramientas de ART LAB. Confirma tu correo para activarla." : isReset ? "Te enviaremos un enlace a tu correo." : isNewPass ? "Elige una contraseña nueva para entrar a ART LAB Tools." : "Tus datos se guardan en la nube y solo tú puedes verlos."}</p>
          ${notice ? `<div class="msg ${kind}" style="margin-bottom:16px">${esc(notice)}</div>` : ""}
          <form class="stack" novalidate>
            ${isSignup ? `
            <div class="campo"><label for="a-nombre">Nombre</label><input id="a-nombre" autocomplete="name" placeholder="Tu nombre" maxlength="80" required></div>` : ""}
            ${isNewPass ? "" : `
            <div class="campo"><label for="a-email">Correo</label><input id="a-email" type="email" autocomplete="email" autocapitalize="off" inputmode="email" placeholder="tu@correo.com" maxlength="254" required></div>`}
            ${isSignup ? `
            <div class="campo"><label for="a-social">Tu cuenta de Instagram o Facebook</label><input id="a-social" autocapitalize="off" placeholder="@tucuenta" maxlength="80" required></div>
            <div class="campo"><label for="a-pais">País</label>
              <select id="a-pais" autocomplete="country-name" required>
                <option value="" disabled selected>Elige tu país</option>
                ${PAISES.map(([iso, dial, n]) => `<option value="${n}" data-iso="${iso}" data-dial="${dial}">${n}</option>`).join("")}
                <option value="Otro país" data-iso="" data-dial="">Otro país</option>
              </select></div>
            <div class="campo"><label for="a-tel">WhatsApp</label><input id="a-tel" type="tel" autocomplete="tel" placeholder="Elige tu país primero" maxlength="32" required></div>` : ""}
            ${isReset ? "" : `
            <div class="campo"><label for="a-pass">${nuevaClave ? "Crea tu contraseña" : "Contraseña"}</label>
              <div class="pwd-wrap"><input id="a-pass" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" placeholder="${isLogin ? "••••••••" : "Mínimo 8 caracteres"}" maxlength="72" required>${OJO}</div>
              ${nuevaClave ? `<small class="help">8 a 72 caracteres: mayúscula, minúscula, número y símbolo.</small>` : ""}
            </div>`}
            ${isSignup ? `
            <label class="consent" for="a-consent"><input id="a-consent" type="checkbox"><span>Quiero recibir guías nuevas y novedades de ART LAB por correo o WhatsApp. Puedo darme de baja cuando quiera.</span></label>` : ""}
            <button class="btn block" type="submit">${isSignup ? "Crear mi cuenta" : isReset ? "Enviar enlace" : isNewPass ? "Guardar contraseña" : "Entrar"}</button>
          </form>
          <div class="login-extra">
            ${isLogin ? `<button class="linkbtn" data-go="signup">Crear cuenta</button><button class="linkbtn soft" data-go="reset">Olvidé mi contraseña</button>` : ""}
            ${isSignup ? `<button class="linkbtn" data-go="login">¿Ya tienes cuenta? Entrar</button>` : ""}
            ${isReset ? `<button class="linkbtn" data-go="login">Volver a entrar</button>` : ""}
          </div>
        </div>
        <p class="login-foot">Creado por <a href="https://artcocoyrodo.com">ART LAB · Cocó &amp; Rodo</a></p>
      </div>`;

    container.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { mode = b.dataset.go; draw(); }));

    const $ = (id) => container.querySelector("#" + id);
    const toggle = container.querySelector(".pwd-toggle");
    if (toggle) toggle.onclick = () => {
      const p = $("a-pass"), ver = p.type === "password";
      p.type = ver ? "text" : "password";
      toggle.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
      toggle.classList.toggle("on", ver);
    };

    // País → prefijo de WhatsApp, igual que en la App
    let dial = "";
    const sincronizarPrefijo = () => {
      const opt = $("a-pais").selectedOptions[0], nuevo = opt?.dataset.dial || "", tel = $("a-tel");
      const actual = tel.value.trim();
      if (!actual || actual === dial) tel.value = nuevo ? nuevo + " " : "";
      else if (dial && nuevo && actual.startsWith(dial + " ")) tel.value = nuevo + " " + actual.slice(dial.length).trim();
      tel.placeholder = nuevo ? nuevo + " tu número" : "+código de país y número";
      dial = nuevo;
    };
    if (isSignup) {
      const iso = paisProbable();
      const opt = iso && [...$("a-pais").options].find((o) => o.dataset.iso === iso);
      if (opt) { $("a-pais").value = opt.value; sincronizarPrefijo(); }
      $("a-pais").onchange = () => { sincronizarPrefijo(); $("a-tel").focus(); };
    }

    const form = container.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      const email = $("a-email")?.value.trim().toLowerCase();
      const password = $("a-pass")?.value;
      if (isSignup) {
        if (!$("a-nombre").value.trim()) return error("Escribe tu nombre.", "a-nombre");
      }
      if (!isNewPass && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) return error("Escribe un correo válido.", "a-email");
      if (!isNewPass && email.endsWith(".con")) return error("El correo termina en «.con». Revisa si debe terminar en «.com».", "a-email");
      if (isSignup) {
        if (!$("a-social").value.trim()) return error("Escribe tu cuenta de Instagram o Facebook.", "a-social");
        if (!$("a-pais").value) return error("Elige tu país.", "a-pais");
        if ($("a-tel").value.replace(/\D/g, "").length < 7) return error("Escribe tu número de WhatsApp.", "a-tel");
      }
      if (isLogin && !password) return error("Escribe tu contraseña.", "a-pass");
      if (isSignup || isNewPass) {
        const problema = errorContrasena(password || "");
        if (problema) return error(problema, "a-pass");
      }
      btn.disabled = true;
      try {
        if (isLogin) {
          const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
          if (err) throw err;
          onReady?.(data.session);
        } else if (isSignup) {
          const opt = $("a-pais").selectedOptions[0];
          const tel = $("a-tel").value.trim();
          const meta = {
            nombre: $("a-nombre").value.trim(),
            red_social: $("a-social").value.trim(),
            pais: $("a-pais").value,
            pais_iso: opt?.dataset.iso || "",
            whatsapp: dial && !tel.startsWith("+") ? dial + " " + tel : tel,
            acepta_novedades: $("a-consent").checked,
          };
          const { data, error: err } = await supabase.auth.signUp({
            email, password,
            options: { data: meta, emailRedirectTo: SITE_URL + location.pathname },
          });
          if (err) throw err;
          if (data.session) onReady?.(data.session);
          else { mode = "login"; draw("¡Listo! Revisa tu correo y confirma tu cuenta. Después vuelve aquí para entrar.", "info"); }
        } else if (isReset) {
          const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + location.pathname });
          if (err) throw err;
          mode = "login"; draw("Si el correo está registrado, te llegará un enlace para crear una nueva contraseña.", "info");
        } else if (isNewPass) {
          const { error: err } = await supabase.auth.updateUser({ password });
          if (err) throw err;
          const { data: s } = await supabase.auth.getSession();
          onReady?.(s.session);
        }
      } catch (err) {
        btn.disabled = false;
        error(traducir(err));
      }
    };

    // Muestra el error arriba del formulario sin borrar lo que la alumna ya escribió
    function error(texto, campo) {
      let box = container.querySelector(".form-error");
      if (!box) {
        box = document.createElement("div");
        box.className = "msg error form-error";
        box.setAttribute("role", "alert");
        form.prepend(box);
      }
      box.textContent = texto;
      container.querySelectorAll(".campo.bad").forEach((c) => c.classList.remove("bad"));
      if (campo) { const el = $(campo); el?.closest(".campo")?.classList.add("bad"); el?.focus(); }
      else box.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") { mode = "newpass"; draw(); }
  });

  draw();
}

function traducir(err) {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("not confirmed")) return "Primero confirma tu cuenta con el enlace que te llegó al correo.";
  if (m.includes("already registered")) return "Ese correo ya tiene cuenta. Entra o recupera tu contraseña.";
  if (m.includes("rate limit") || m.includes("security purposes")) return "Demasiados intentos. Espera un minuto y vuelve a intentar.";
  if (err?.code === "weak_password" || /weak|pwned|leaked|compromised/.test(m)) return "Contraseña débil o conocida en filtraciones. Elige otra diferente.";
  if (m.includes("password")) return "La contraseña no cumple los requisitos: 8 a 72 caracteres, mayúscula, minúscula, número y símbolo.";
  return "No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.";
}

// Devuelve la sesión activa o muestra el login dentro de `container`.
export async function withSession(container, onReady, opts) {
  const { data } = await supabase.auth.getSession();
  if (data.session && !IS_RECOVERY) return onReady(data.session);
  renderAuth(container, { ...opts, onReady, initialMode: IS_RECOVERY ? "newpass" : "login" });
}

export { esc };
