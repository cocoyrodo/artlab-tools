// ART LAB Tools · translate
//
// Traduce textos de la interfaz con Google Cloud Translation API v2, igual
// que la función `translate` de la App ART LAB, y guarda cada resultado en
// public.translation_cache para no volver a pagarlo.
//
// Orden de búsqueda: 1) translation_cache (traducciones manuales revisadas y
// traducciones de Google ya hechas) → 2) Google, solo para lo que falte.
//
// Body:      { target: "en"|"fr"|"it"|"pt"|"nl", texts: string[] }
// Respuesta: { translations: string[] }  (mismo orden y largo que `texts`)
//
// Requiere sesión de ART LAB Tools: así nadie ajeno puede gastar la cuota.
// La API Key de Google vive solo como secreto en Supabase:
//   ARTLAB_GOOGLE_TRANSLATE_API_KEY (mismo nombre que en la App y en wp-config.php)

import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://tools.artcocoyrodo.com",
  "http://localhost:8765",
]);

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://tools.artcocoyrodo.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

const ALLOWED_TARGETS = new Set(["en", "fr", "it", "pt", "nl"]);

// Igual que la App, más los nombres de servicios de manicura que no se traducen.
const PROTECTED_TERMS = [
  "ART LAB Tools",
  "ART LAB",
  "Cocó & Rodo",
  "Cocó y Rodo",
  "Parametrización Exacta",
  "Soft gel",
  "Kapping",
  "Nail art",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "Reels",
];

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Se manda a Google en formato HTML: los términos protegidos y las variables
// {x} van dentro de <span class="notranslate">, y las etiquetas <em> del texto
// original se conservan como HTML real.
function protect(text: string): string {
  let out = escapeHtml(text).replace(/&lt;(\/?)em&gt;/g, "<$1em>");
  out = out.replace(/\{\w+\}/g, (v) => `<span class="notranslate">${v}</span>`);
  for (const term of PROTECTED_TERMS) {
    out = out.replace(new RegExp(`(?<![\\w>])${escapeRe(escapeHtml(term))}(?![\\w<])`, "gi"),
      (m) => `<span class="notranslate">${m}</span>`);
  }
  return out;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function unprotect(html: string): string {
  const sinSpans = html.replace(/<span class="notranslate">([\s\S]*?)<\/span>/g, "$1");
  return decodeHtmlEntities(sinSpans);
}

// La traducción debe conservar las mismas variables {x} y etiquetas <em>
const marcas = (s: string) => [...s.matchAll(/\{\w+\}|<\/?em>/g)].map((m) => m[0]).sort().join(" ");

async function callGoogleTranslate(apiKey: string, texts: string[], target: string): Promise<string[]> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texts, source: "es", target, format: "html" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.data?.translations) {
    throw new Error(body?.error?.message || "Google Translation API no respondió correctamente.");
  }
  return body.data.translations.map((t: { translatedText?: string }) => t.translatedText || "");
}

function getApiKey(): string | undefined {
  return Deno.env.get("ARTLAB_GOOGLE_TRANSLATE_API_KEY")
    || Deno.env.get("GOOGLE_TRANSLATE_API_KEY")
    || Deno.env.get("ARTLAB_GOOGLE_TRANSLATE_KEY");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "unauthorized", message: "Sesión inválida o expirada." }, 401, origin);

    const cache = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const payload = await req.json().catch(() => ({}));
    const target = String(payload.target || "");
    const texts: string[] = Array.isArray(payload.texts) ? payload.texts.map((t: unknown) => String(t ?? "")) : [];
    if (!ALLOWED_TARGETS.has(target)) return json({ error: "bad_target", message: "Idioma no permitido." }, 400, origin);
    if (texts.length === 0) return json({ translations: [] }, 200, origin);
    if (texts.length > 200 || texts.reduce((sum, t) => sum + t.length, 0) > 20000) {
      return json({ error: "payload_too_large", message: "La solicitud de traducción es demasiado grande." }, 413, origin);
    }

    const unique = Array.from(new Set(texts.filter((t) => t.trim() !== "")));
    const hashes = await Promise.all(unique.map((t) => sha256(t)));
    const { data: rows } = await cache.from("translation_cache")
      .select("hash, translated").eq("target", target).in("hash", hashes);
    const enCache = new Map<string, string>((rows || []).map((r: { hash: string; translated: string }) => [r.hash, r.translated]));

    const resultado = new Map<string, string>();
    const faltan: { text: string; hash: string }[] = [];
    unique.forEach((t, i) => {
      const c = enCache.get(hashes[i]);
      if (c !== undefined) resultado.set(t, c);
      else faltan.push({ text: t, hash: hashes[i] });
    });

    if (faltan.length > 0) {
      const apiKey = getApiKey();
      if (!apiKey) {
        return json({ error: "not_configured", message: "Falta la API Key de Google Translate como secreto en Supabase." }, 503, origin);
      }
      const nuevas: { target: string; hash: string; source: string; translated: string; origen: string }[] = [];
      for (let start = 0; start < faltan.length; start += 100) {
        const lote = faltan.slice(start, start + 100);
        const traducidas = await callGoogleTranslate(apiKey, lote.map((f) => protect(f.text)), target);
        lote.forEach((f, i) => {
          const final = unprotect(traducidas[i] || "");
          // Si Google perdió una variable o un <em>, se deja el español y no se guarda
          if (!final.trim() || marcas(final) !== marcas(f.text)) return;
          resultado.set(f.text, final);
          nuevas.push({ target, hash: f.hash, source: f.text, translated: final, origen: "google" });
        });
      }
      // ignoreDuplicates: nunca pisa una traducción manual guardada por otra solicitud
      if (nuevas.length > 0) await cache.from("translation_cache").upsert(nuevas, { onConflict: "target,hash", ignoreDuplicates: true });
    }

    return json({ translations: texts.map((t) => (t.trim() === "" ? "" : (resultado.get(t) ?? t))) }, 200, origin);
  } catch (err) {
    return json({ error: "translate_error", message: String((err as Error)?.message ?? err) }, 500, origin);
  }
});
