// Sesión compartida por todas las herramientas de ART LAB Tools.
// Solo usa la clave pública (publishable/anon) de Supabase: la seguridad
// de los datos la garantiza Row Level Security en la base de datos.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SITE_URL } from "/assets/config.js?v=20261026c";

// Se lee antes de crear el cliente, porque el cliente limpia el hash al procesarlo
const IS_RECOVERY = location.hash.includes("type=recovery");

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Pantalla de ingreso / registro / recuperación, con el diseño del login de la App ART LAB.
// Llama a onReady(session) al entrar.
export function renderAuth(container, { title = "Entra a ART LAB Tools", onReady, initialMode = "login" } = {}) {
  let mode = initialMode;

  const draw = (notice = "", kind = "info") => {
    const isLogin = mode === "login", isSignup = mode === "signup", isReset = mode === "reset", isNewPass = mode === "newpass";
    container.innerHTML = `
      <div class="login-page">
        <div class="deco-circle"></div><div class="deco-circle small"></div>
        <header class="login-header">
          <a href="/"><img src="/assets/brand/logo-pink-black.webp" alt="Cocó & Rodo — ART LAB"></a>
          <p class="login-frase">Herramientas para tu negocio.<br>Organiza, crece y disfruta tu arte.</p>
        </header>
        <div class="login-card">
          <h2>${isSignup ? "Crea tu cuenta" : isReset ? "Recupera tu contraseña" : isNewPass ? "Nueva contraseña" : esc(title)}</h2>
          <p class="lead">${isSignup ? "Una sola cuenta para todas las herramientas de ART LAB." : isReset ? "Te enviaremos un enlace a tu correo." : isNewPass ? "Escribe tu nueva contraseña." : "Tus datos se guardan en la nube y solo tú puedes verlos."}</p>
          ${notice ? `<div class="msg ${kind}" style="margin-bottom:16px">${esc(notice)}</div>` : ""}
          <form class="stack" novalidate>
            ${isSignup ? `<div class="campo"><label for="a-nombre">Tu nombre</label><input id="a-nombre" autocomplete="name" placeholder="¿Cómo te llamas?" required></div>` : ""}
            ${isNewPass ? "" : `<div class="campo"><label for="a-email">Correo</label><input id="a-email" type="email" autocomplete="email" inputmode="email" placeholder="tu@correo.com" required></div>`}
            ${isReset ? "" : `<div class="campo"><label for="a-pass">Contraseña</label><input id="a-pass" type="password" minlength="8" autocomplete="${isLogin ? "current-password" : "new-password"}" placeholder="${isLogin ? "••••••••" : "Mínimo 8 caracteres"}" required></div>`}
            <button class="btn block" type="submit">${isSignup ? "Crear cuenta" : isReset ? "Enviar enlace" : isNewPass ? "Guardar contraseña" : "Entrar"}</button>
          </form>
          <div class="login-extra">
            ${isLogin ? `<button class="linkbtn" data-go="signup">Crear cuenta</button><button class="linkbtn soft" data-go="reset">Olvidé mi contraseña</button>` : ""}
            ${isSignup || isReset ? `<button class="linkbtn" data-go="login">Ya tengo cuenta, quiero entrar</button>` : ""}
          </div>
        </div>
        <p class="login-foot">Creado por <a href="https://artcocoyrodo.com">ART LAB · Cocó &amp; Rodo</a></p>
      </div>`;

    container.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { mode = b.dataset.go; draw(); }));

    const form = container.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      const email = form.querySelector("#a-email")?.value.trim();
      const password = form.querySelector("#a-pass")?.value;
      if (!isNewPass && !email) return draw("Escribe tu correo.", "error");
      if (!isReset && (!password || password.length < 8)) return draw("La contraseña debe tener al menos 8 caracteres.", "error");
      btn.disabled = true;
      try {
        if (isLogin) {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          onReady?.(data.session);
        } else if (isSignup) {
          const nombre = form.querySelector("#a-nombre").value.trim();
          const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { nombre }, emailRedirectTo: SITE_URL + location.pathname },
          });
          if (error) throw error;
          if (data.session) onReady?.(data.session);
          else { mode = "login"; draw("Revisa tu correo y confirma tu cuenta. Después vuelve aquí para entrar.", "info"); }
        } else if (isReset) {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + location.pathname });
          if (error) throw error;
          mode = "login"; draw("Si el correo está registrado, te llegará un enlace para crear una nueva contraseña.", "info");
        } else if (isNewPass) {
          const { data, error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          const { data: s } = await supabase.auth.getSession();
          onReady?.(s.session ?? data);
        }
      } catch (err) {
        draw(traducir(err), "error");
      }
    };
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
  if (m.includes("password")) return "La contraseña no cumple los requisitos (mínimo 8 caracteres).";
  return "No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.";
}

// Devuelve la sesión activa o muestra el login dentro de `container`.
export async function withSession(container, onReady, opts) {
  const { data } = await supabase.auth.getSession();
  if (data.session && !IS_RECOVERY) return onReady(data.session);
  renderAuth(container, { ...opts, onReady, initialMode: IS_RECOVERY ? "newpass" : "login" });
}

export { esc };
