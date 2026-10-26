# Correos de ART LAB Tools (Supabase Auth + Google + Resend)

Proyecto Supabase: `psljtvkwhenjvbinrowk` (artlab-tools).

## Cómo funciona

Supabase Auth **no usa sus plantillas**: con el **Send Email Hook** activado,
cada correo de cuenta (confirmar registro, restablecer contraseña, cambiar
correo, invitación, enlace mágico, código) lo arma la Edge Function
`send-email`:

1. Escribe el correo en español (textos en `supabase/functions/send-email/index.ts`).
2. Lo traduce al idioma de la alumna (`user_metadata.lang`, que Tools guarda al
   registrarse y al cambiar el selector) con la **misma base de datos de
   traducciones + Google Cloud Translation** que la interfaz
   (`supabase/functions/_shared/traducir.ts`). Cada texto se traduce con Google
   una sola vez; después sale de `translation_cache`.
3. Lo envía por **Resend** desde `ART LAB <noreply@send.artcocoyrodo.com>`.

Si Google no responde, el correo sale igual, en español. Si Resend falla, la
función responde error y Supabase muestra el error en Auth → Logs.

Regla de marca: nunca "gratis", "free", "gratuit", "gratuito" ni "regalo".

## Secretos (Edge Functions → Secrets)

| Nombre | Qué es |
|---|---|
| `RESEND_API_KEY` | Clave de Resend, permiso *Sending access*, dominio `send.artcocoyrodo.com` |
| `ARTLAB_GOOGLE_TRANSLATE_API_KEY` | Clave de Google Cloud Translation (la misma de la App) |
| `SEND_EMAIL_HOOK_SECRET` | La genera Supabase al crear el hook (`v1,whsec_…`) |

Nunca se guardan en GitHub.

## Activar el hook

Authentication → **Auth Hooks** → *Add a new hook* → **Send Email hook**:
- Hook type: **HTTPS**
- URL: `https://psljtvkwhenjvbinrowk.supabase.co/functions/v1/send-email`
- **Generate secret** → copiarlo → guardarlo como secreto `SEND_EMAIL_HOOK_SECRET`.
- Activar el hook solo cuando los 3 secretos estén guardados.

## Respaldo

El SMTP de Resend (Authentication → Emails → SMTP Settings) y las plantillas
de Supabase quedan configurados como respaldo: si se desactiva el hook,
Supabase vuelve a enviar con ellos.

## Cómo probarlo

1. tools.artcocoyrodo.com → selector **EN** → crear cuenta con un correo de prueba.
2. Debe llegar el correo en inglés desde `noreply@send.artcocoyrodo.com`.
3. En Supabase → `translation_cache` aparecen los textos del correo con
   `origen = google` y `target = en`; un segundo registro en inglés ya no llama a Google.
4. Si no llega: Supabase → Edge Functions → `send-email` → Logs, y Resend → Emails.
