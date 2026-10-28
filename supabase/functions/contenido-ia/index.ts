// Contenido — guiones, ganchos y calendario de Reels con Claude.
//
// POST con sesión (verify_jwt = true): { tipo: "guion" | "ganchos" | "calendario", pedido, lang }
// 1. Lee el perfil de marca de la usuaria (contenido_perfil).
// 2. Cobra créditos (contenido_cobrar, atómico). Si no alcanzan → 402.
// 3. Pide a Claude la pieza con salida JSON estructurada.
// 4. Guarda la pieza (contenido_piezas) y devuelve { pieza, saldo }.
// Si Claude falla después de cobrar, devuelve los créditos (contenido_devolver).
// Secreto necesario: ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";
const COSTO: Record<string, number> = { guion: 1, ganchos: 1, calendario: 5 };
const IDIOMAS: Record<string, string> = { es: "español", en: "English", fr: "français", it: "italiano", pt: "português", nl: "Nederlands" };
const ORIGENES = ["https://tools.artcocoyrodo.com", "http://localhost:8000"];

const cors = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.includes(origin) ? origin : ORIGENES[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" } });

const str = { type: "string" };
const SCHEMAS: Record<string, Record<string, unknown>> = {
  guion: {
    type: "object",
    properties: {
      titulo: str,
      gancho: str,
      desarrollo: str,
      cierre: str,
      cta: str,
      palabra_clave: str,
      texto_en_pantalla: { type: "array", items: str },
      caption: str,
      hashtags: { type: "array", items: str },
      duracion_segundos: { type: "integer" },
    },
    required: ["titulo", "gancho", "desarrollo", "cierre", "cta", "palabra_clave", "texto_en_pantalla", "caption", "hashtags", "duracion_segundos"],
    additionalProperties: false,
  },
  ganchos: {
    type: "object",
    properties: {
      ganchos: {
        type: "array",
        items: { type: "object", properties: { texto: str, por_que: str }, required: ["texto", "por_que"], additionalProperties: false },
      },
    },
    required: ["ganchos"],
    additionalProperties: false,
  },
  calendario: {
    type: "object",
    properties: {
      dias: {
        type: "array",
        items: {
          type: "object",
          properties: { dia: { type: "integer" }, formato: str, tema: str, gancho: str, objetivo: str },
          required: ["dia", "formato", "tema", "gancho", "objetivo"],
          additionalProperties: false,
        },
      },
    },
    required: ["dias"],
    additionalProperties: false,
  },
};

// Fijo (sin datos de la usuaria) para que se pueda cachear igual en cada pedido
const SYSTEM = `Eres la estratega de contenido de ART LAB Tools. Escribes contenido para Instagram (Reels) de dueñas de negocio y emprendedoras de cualquier rubro.

Principios:
- El objetivo es vender, no solo entretener: cada pieza termina con UNA sola acción concreta (comentar una palabra clave, escribir por DM, agendar, guardar).
- El gancho nombra un problema o deseo real de su clienta en los primeros 2 segundos. Nada de "Hola, hoy les traigo".
- Hablas del problema que la clienta pagaría por resolver, no de "lo que yo hago".
- Escribes con la voz de la dueña del negocio: imita su forma de escribir a partir de sus textos reales cuando los hay (palabras, emojis, largo de frases), sin copiar frases enteras.
- Frases cortas, para decir mirando a cámara. Nada inventado sobre resultados, cifras o testimonios.
- La palabra clave del CTA es una sola palabra en mayúsculas, fácil de escribir.
- Escribe todo en el idioma que se te indique.`;

function contexto(p: Record<string, string> | null): string {
  if (!p) return "No completó su perfil de marca: escribe para un negocio pequeño genérico.";
  const linea = (k: string, v: string) => (v?.trim() ? `${k}: ${v.trim()}\n` : "");
  return (
    linea("Rubro", p.rubro) + linea("Su negocio", p.negocio) + linea("Lo que vende", p.oferta) +
    linea("Su clienta ideal", p.publico) + linea("Tono", p.tono) + linea("Instagram", p.instagram) +
    (p.voz?.trim() ? `\nTextos reales suyos (para imitar su voz):\n"""\n${p.voz.trim()}\n"""\n` : "")
  );
}

function instruccion(tipo: string, pedido: string): string {
  if (tipo === "guion") {
    return `Escribe un guion de Reel de 30 a 60 segundos sobre esta idea: "${pedido}".
gancho = la primera frase (máx. 15 palabras). desarrollo = el cuerpo, en líneas cortas separadas por saltos de línea. cierre = la frase que conecta con la acción. cta = la acción exacta usando palabra_clave. texto_en_pantalla = 3 a 5 textos cortos para sobreimprimir. caption = el texto del post, terminado con el mismo CTA. hashtags = 5 a 8, sin el símbolo #.`;
  }
  if (tipo === "ganchos") {
    return `Escribe exactamente 10 ganchos distintos para Reels sobre este tema: "${pedido || "su negocio"}". Mezcla tipos: pregunta, error común, mito, resultado, antes/después, secreto del oficio. por_que = en una frase, por qué detiene el scroll.`;
  }
  return `Arma un calendario de 30 días de Reels (dia 1 a 30), uno por día, para vender más. ${pedido ? `Foco pedido: "${pedido}".` : ""}
formato = tipo de Reel (tutorial, proceso, antes/después, error común, detrás de cámara, testimonio real, oferta, pregunta frecuente). Alterna formatos y deja 1 de cada 4 días para vender directo. objetivo = alcance, confianza o venta.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") || "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(req, { error: "unauthorized" }, 401);

  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));
  const tipo = String(body.tipo || "");
  const pedido = String(body.pedido || "").trim().slice(0, 500);
  const idioma = IDIOMAS[String(body.lang || "es")] || IDIOMAS.es;
  if (!COSTO[tipo]) return json(req, { error: "tipo_invalido" }, 400);
  if (tipo === "guion" && pedido.length < 3) return json(req, { error: "falta_idea" }, 400);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json(req, { error: "ia_no_configurada" }, 503);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: perfil } = await admin.from("contenido_perfil").select("*").eq("user_id", user.id).maybeSingle();

  const costo = COSTO[tipo];
  const { data: saldo, error: errCobro } = await admin.rpc("contenido_cobrar", { p_user: user.id, p_n: costo });
  if (errCobro) return json(req, { error: "cobro_fallido" }, 500);
  if (saldo < 0) return json(req, { error: "sin_creditos" }, 402);

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMAS[tipo] } },
      messages: [{
        role: "user",
        content: `Idioma de respuesta: ${idioma}.\n\nNegocio:\n${contexto(perfil)}\n${instruccion(tipo, pedido)}`,
      }],
    // deno-lint-ignore no-explicit-any
    } as any);

    if (res.stop_reason === "refusal") throw new Error("refusal");
    if (res.stop_reason === "max_tokens") throw new Error("max_tokens");
    // deno-lint-ignore no-explicit-any
    const texto = (res.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("");
    const resultado = JSON.parse(texto);

    const { data: pieza, error } = await admin.from("contenido_piezas")
      .insert({ user_id: user.id, tipo, pedido, resultado, creditos: costo })
      .select("id, tipo, pedido, resultado, created_at").single();
    if (error) throw error;
    console.log("contenido-ia ok", tipo, res.usage?.input_tokens, res.usage?.output_tokens, res.usage?.cache_read_input_tokens);
    return json(req, { pieza, saldo });
  } catch (e) {
    await admin.rpc("contenido_devolver", { p_user: user.id, p_n: costo });
    const msg = e instanceof Error ? e.message : String(e);
    console.error("contenido-ia falló", tipo, msg);
    if (e instanceof Anthropic.RateLimitError) return json(req, { error: "ocupado" }, 429);
    return json(req, { error: msg === "refusal" ? "rechazado" : "ia_fallida" }, 502);
  }
});
