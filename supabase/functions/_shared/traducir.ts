// Traducción compartida de ART LAB Tools (Edge Functions `translate` y `send-email`).
//
// Igual que la App ART LAB: Google Cloud Translation API v2 con caché en la
// base de datos. Orden: 1) public.translation_cache (traducciones manuales
// revisadas y de Google ya hechas) → 2) Google, solo para lo que falte, y se
// guarda para no volver a pagarlo.
//
// Secreto: ARTLAB_GOOGLE_TRANSLATE_API_KEY (mismo nombre que en la App).

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const IDIOMAS = new Set(["en", "fr", "it", "pt", "nl"]);

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
  return decodeHtmlEntities(html.replace(/<span class="notranslate">([\s\S]*?)<\/span>/g, "$1"));
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

export class SinClaveGoogle extends Error {}

export function clienteCache(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Traduce textos en español al idioma `target`. Devuelve el mismo orden y largo.
// Un texto que Google no pudo traducir bien se devuelve en español y no se guarda.
export async function traducir(cache: SupabaseClient, target: string, texts: string[]): Promise<string[]> {
  if (!IDIOMAS.has(target)) return texts;
  const unique = Array.from(new Set(texts.filter((t) => t.trim() !== "")));
  if (unique.length === 0) return texts;

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
    if (!apiKey) throw new SinClaveGoogle("Falta la API Key de Google Translate como secreto en Supabase.");
    const nuevas: { target: string; hash: string; source: string; translated: string; origen: string }[] = [];
    for (let start = 0; start < faltan.length; start += 100) {
      const lote = faltan.slice(start, start + 100);
      const traducidas = await callGoogleTranslate(apiKey, lote.map((f) => protect(f.text)), target);
      lote.forEach((f, i) => {
        const final = unprotect(traducidas[i] || "");
        if (!final.trim() || marcas(final) !== marcas(f.text)) return;
        resultado.set(f.text, final);
        nuevas.push({ target, hash: f.hash, source: f.text, translated: final, origen: "google" });
      });
    }
    // ignoreDuplicates: nunca pisa una traducción manual guardada por otra solicitud
    if (nuevas.length > 0) await cache.from("translation_cache").upsert(nuevas, { onConflict: "target,hash", ignoreDuplicates: true });
  }

  return texts.map((t) => (t.trim() === "" ? "" : (resultado.get(t) ?? t)));
}
