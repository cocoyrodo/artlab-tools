// ART LAB Tools · translate
//
// Traduce textos de la interfaz con Google Cloud Translation API v2, igual
// que la función `translate` de la App ART LAB, usando la base de datos de
// traducciones (public.translation_cache). La lógica vive en _shared/traducir.ts,
// que también usa `send-email` para los correos.
//
// Body:      { target: "en"|"fr"|"it"|"pt"|"nl", texts: string[] }
// Respuesta: { translations: string[] }  (mismo orden y largo que `texts`)
//
// Requiere sesión de ART LAB Tools: así nadie ajeno puede gastar la cuota.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { clienteCache, IDIOMAS, SinClaveGoogle, traducir } from "../_shared/traducir.ts";

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

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "unauthorized", message: "Sesión inválida o expirada." }, 401, origin);

    const payload = await req.json().catch(() => ({}));
    const target = String(payload.target || "");
    const texts: string[] = Array.isArray(payload.texts) ? payload.texts.map((t: unknown) => String(t ?? "")) : [];
    if (!IDIOMAS.has(target)) return json({ error: "bad_target", message: "Idioma no permitido." }, 400, origin);
    if (texts.length === 0) return json({ translations: [] }, 200, origin);
    if (texts.length > 200 || texts.reduce((sum, t) => sum + t.length, 0) > 20000) {
      return json({ error: "payload_too_large", message: "La solicitud de traducción es demasiado grande." }, 413, origin);
    }

    const translations = await traducir(clienteCache(), target, texts);
    return json({ translations }, 200, origin);
  } catch (err) {
    if (err instanceof SinClaveGoogle) return json({ error: "not_configured", message: err.message }, 503, origin);
    return json({ error: "translate_error", message: String((err as Error)?.message ?? err) }, 500, origin);
  }
});
