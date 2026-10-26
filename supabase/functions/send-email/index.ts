// ART LAB Tools · send-email (Supabase Auth "Send Email Hook")
//
// Supabase Auth llama a esta función en vez de usar sus plantillas cada vez
// que necesita enviar un correo (confirmar cuenta, restablecer contraseña,
// cambiar correo…). La función:
//   1. arma el correo en español,
//   2. lo traduce al idioma de la alumna (user_metadata.lang) con la base de
//      datos de traducciones + Google Cloud Translation (_shared/traducir.ts),
//   3. lo envía por Resend desde noreply@send.artcocoyrodo.com.
// Si la traducción falla, el correo sale igual, en español: nunca se bloquea.
//
// Secretos (Edge Functions → Secrets):
//   SEND_EMAIL_HOOK_SECRET  lo genera Supabase al activar el hook (v1,whsec_…)
//   RESEND_API_KEY          clave de Resend con permiso de envío
//   ARTLAB_GOOGLE_TRANSLATE_API_KEY  (la misma de `translate`)

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { clienteCache, traducir } from "../_shared/traducir.ts";

const REMITENTE = "ART LAB <noreply@send.artcocoyrodo.com>";
const SITIO = "https://tools.artcocoyrodo.com";

type Datos = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
};

// Textos en español (son la clave de traducción). {correo} y {codigo} no se traducen.
const CORREOS: Record<string, { asunto: string; titulo: string; texto: string; boton?: string; nota: string }> = {
  signup: {
    asunto: "Confirma tu correo — ART LAB Tools",
    titulo: "Confirma tu correo electrónico",
    texto: "Usa el botón de abajo para confirmar este correo y terminar tu registro en ART LAB Tools.",
    boton: "Confirmar correo electrónico",
    nota: "Si no creaste esta cuenta, puedes ignorar este correo.",
  },
  recovery: {
    asunto: "Restablece tu contraseña — ART LAB Tools",
    titulo: "Restablece tu contraseña",
    texto: "Recibimos una solicitud para restablecer la contraseña de tu cuenta de ART LAB Tools. Usa el botón de abajo para elegir una nueva.",
    boton: "Elegir nueva contraseña",
    nota: "Si no lo pediste tú, ignora este correo: tu contraseña sigue igual.",
  },
  email_change: {
    asunto: "Confirma el cambio de correo — ART LAB Tools",
    titulo: "Confirma el cambio de correo",
    texto: "Pediste cambiar el correo de tu cuenta de ART LAB Tools a {correo}. Usa el botón de abajo para confirmarlo.",
    boton: "Confirmar el cambio",
    nota: "Si no pediste este cambio, ignora este correo: tu cuenta sigue igual.",
  },
  invite: {
    asunto: "Activa tu cuenta — ART LAB Tools",
    titulo: "Te damos la bienvenida a ART LAB Tools",
    texto: "Tu cuenta ya está lista. Usa el botón de abajo para activarla y crear tu contraseña.",
    boton: "Activar mi cuenta",
    nota: "Si no esperabas este correo, puedes ignorarlo.",
  },
  magiclink: {
    asunto: "Tu enlace para entrar — ART LAB Tools",
    titulo: "Entra a ART LAB Tools",
    texto: "Usa el botón de abajo para entrar a tu cuenta.",
    boton: "Entrar",
    nota: "Si no lo pediste tú, puedes ignorar este correo.",
  },
  reauthentication: {
    asunto: "Tu código de verificación — ART LAB Tools",
    titulo: "Tu código de verificación",
    texto: "Escribe este código en ART LAB Tools para continuar: {codigo}",
    nota: "Si no lo pediste tú, puedes ignorar este correo.",
  },
};
const PIE = "Creado por ART LAB · Cocó & Rodo";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const llenar = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));

function enlace(d: Datos, tokenHash: string, tipo: string) {
  const base = Deno.env.get("SUPABASE_URL")!;
  const destino = d.redirect_to || d.site_url || SITIO;
  return `${base}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(tipo)}&redirect_to=${encodeURIComponent(destino)}`;
}

async function armar(tipo: string, lang: string, vars: Record<string, string>, url?: string) {
  const base = CORREOS[tipo] ?? CORREOS.signup;
  const claves = [base.asunto, base.titulo, base.texto, base.boton ?? "", base.nota, PIE];
  let tr = claves;
  if (lang && lang !== "es") {
    try { tr = await traducir(clienteCache(), lang, claves); }
    catch (e) { console.error("send-email: traducción no disponible, se envía en español", e); }
  }
  const [asunto, titulo, texto, boton, nota, pie] = tr;
  const textoHtml = llenar(esc(texto), Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, `<b>${esc(v)}</b>`])));
  const html = `<!doctype html><html lang="${esc(lang || "es")}"><body style="margin:0;background:#FDF0F7">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 22px;color:#1A0010">
  <p style="font-size:12px;letter-spacing:2px;color:#CC00A3;font-weight:bold;margin:0 0 20px">ART LAB TOOLS</p>
  <h2 style="margin:0 0 12px;font-size:22px">${esc(titulo)}</h2>
  <p style="font-size:15px;line-height:1.55;margin:0">${textoHtml}</p>
  ${url && boton ? `<p style="margin:28px 0"><a href="${esc(url)}" style="background:#CC00A3;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:30px;font-weight:bold;display:inline-block">${esc(boton)}</a></p>` : ""}
  <p style="font-size:13px;line-height:1.5;color:#6B3A55">${esc(nota)}</p>
  <p style="font-size:12px;color:#6B3A55;margin-top:28px">${esc(pie)} · tools.artcocoyrodo.com</p>
</div></body></html>`;
  const textoPlano = [titulo, llenar(texto, vars), url ? `${boton}: ${url}` : "", nota, pie].filter(Boolean).join("\n\n");
  return { asunto, html, textoPlano };
}

async function enviar(para: string, correo: { asunto: string; html: string; textoPlano: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMITENTE, to: [para], subject: correo.asunto, html: correo.html, text: correo.textoPlano }),
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text().catch(() => "")}`);
}

const respuesta = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return respuesta(405, { error: { http_code: 405, message: "method_not_allowed" } });
  try {
    // Solo Supabase Auth puede llamar a esta función: firma Standard Webhooks
    const secreto = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "").replace(/^v1,whsec_/, "");
    if (!secreto) throw new Error("Falta el secreto SEND_EMAIL_HOOK_SECRET.");
    if (!Deno.env.get("RESEND_API_KEY")) throw new Error("Falta el secreto RESEND_API_KEY.");
    const cuerpo = await req.text();
    const { user, email_data: d } = new Webhook(secreto).verify(cuerpo, Object.fromEntries(req.headers)) as {
      user: { email: string; new_email?: string; user_metadata?: { lang?: string } };
      email_data: Datos;
    };
    const lang = String(user.user_metadata?.lang || "es");
    const tipo = d.email_action_type;

    if (tipo === "email_change") {
      // Cambio de correo seguro: un correo al actual y otro al nuevo.
      // Por compatibilidad de Supabase, token_hash_new es el del correo ACTUAL
      // y token_hash el del correo NUEVO.
      const vars = { correo: user.new_email || "" };
      if (d.token_hash_new) await enviar(user.email, await armar(tipo, lang, vars, enlace(d, d.token_hash_new, "email_change")));
      if (user.new_email && d.token_hash) await enviar(user.new_email, await armar(tipo, lang, vars, enlace(d, d.token_hash, "email_change")));
    } else if (tipo === "reauthentication") {
      await enviar(user.email, await armar(tipo, lang, { codigo: d.token }));
    } else {
      await enviar(user.email, await armar(tipo, lang, {}, enlace(d, d.token_hash, tipo)));
    }
    return respuesta(200, {});
  } catch (err) {
    console.error("send-email:", err);
    return respuesta(500, { error: { http_code: 500, message: String((err as Error)?.message ?? err) } });
  }
});
