// Configuración pública. La clave publishable/anon está pensada para ir en el
// navegador: los datos están protegidos por Row Level Security.
// NUNCA poner aquí la service_role key ni otro secreto.
export const SUPABASE_URL = "https://psljtvkwhenjvbinrowk.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WS2g4WpPkVc0vryq650tBw_QG1zJvs0";
export const SITE_URL = location.origin;
// Auditoría de Instagram: Edge Function pública del proyecto ART LAB (tiene la conexión con Meta).
export const AUDITORIA_URL = "https://sxwsrztcgaccxbueidhe.supabase.co/functions/v1/artlab-ig-audit";
