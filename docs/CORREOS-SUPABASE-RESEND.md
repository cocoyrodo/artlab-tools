# Correos de ART LAB Tools (Supabase Auth + Resend)

Proyecto Supabase: `psljtvkwhenjvbinrowk` (artlab-tools). Todo se configura
**a mano en el panel de Supabase**; este archivo es la copia documentada de lo
que debe quedar pegado ahí. Igual que en la App ART LAB: envío por **Resend**
desde el dominio verificado `send.artcocoyrodo.com`, plantillas en 6 idiomas
según `user_metadata.lang` (Tools lo guarda al registrarse y al cambiar de
idioma). Sin idioma, el correo sale en español.

Regla de marca: nunca "gratis", "free", "gratuit", "gratuito" ni "regalo".

## 1. Clave de Resend para Tools

Resend → **API Keys** → **Create API Key**
- Name: `ART LAB Tools (Supabase Auth)`
- Permission: **Sending access**
- Domain: `send.artcocoyrodo.com`

Se copia una sola vez y se pega directo en Supabase (paso 2). Nunca en GitHub.
Una clave propia para Tools permite revocarla sin afectar a la App.

## 2. SMTP en Supabase

Supabase → Project Settings → **Authentication** → **SMTP Settings** →
*Enable Custom SMTP*:

| Campo | Valor |
|---|---|
| Sender email | `noreply@send.artcocoyrodo.com` |
| Sender name | `ART LAB` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clave de Resend del paso 1 |
| Minimum interval between emails | `60` segundos (valor por defecto) |

Después: Authentication → **Rate Limits** → *Rate limit for sending emails*:
subirlo a `100` por hora (con SMTP propio Supabase permite cambiarlo).

## 3. Plantillas

Authentication → **Emails** → **Templates**. Si al probar un asunto llega con
el código a la vista, usar el asunto fijo de respaldo.

### 3.1 Confirm signup (Confirmar registro)

**Asunto:**
```
{{ $l := printf "%v" .Data.lang }}{{ if eq $l "en" }}Confirm your account — ART LAB Tools{{ else if eq $l "pt" }}Confirme sua conta — ART LAB Tools{{ else if eq $l "fr" }}Confirmez votre compte — ART LAB Tools{{ else if eq $l "it" }}Conferma il tuo account — ART LAB Tools{{ else if eq $l "nl" }}Bevestig je account — ART LAB Tools{{ else }}Confirma tu cuenta — ART LAB Tools{{ end }}
```
Respaldo: `Confirma tu cuenta · Confirm your account — ART LAB Tools`

**Cuerpo:**
```html
{{ $l := printf "%v" .Data.lang }}
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:28px 22px;color:#1A0010;background:#FDF0F7;border-radius:20px">
  <p style="font-size:13px;letter-spacing:2px;color:#CC00A3;font-weight:bold;margin:0 0 18px">ART LAB TOOLS</p>
{{ if eq $l "en" }}
  <h2 style="margin:0 0 12px">Confirm your account</h2>
  <p>Almost there. Confirm your email to activate your ART LAB Tools account.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Confirm my account</a></p>
  <p style="font-size:13px;color:#6B3A55">Then log in at tools.artcocoyrodo.com with this email and your password. If you didn't create this account, you can ignore this email.</p>
{{ else if eq $l "pt" }}
  <h2 style="margin:0 0 12px">Confirme sua conta</h2>
  <p>Falta pouco. Confirme seu e-mail para ativar sua conta do ART LAB Tools.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Confirmar minha conta</a></p>
  <p style="font-size:13px;color:#6B3A55">Depois entre em tools.artcocoyrodo.com com este e-mail e sua senha. Se você não criou esta conta, pode ignorar este e-mail.</p>
{{ else if eq $l "fr" }}
  <h2 style="margin:0 0 12px">Confirmez votre compte</h2>
  <p>Presque terminé. Confirmez votre e-mail pour activer votre compte ART LAB Tools.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Confirmer mon compte</a></p>
  <p style="font-size:13px;color:#6B3A55">Connectez-vous ensuite sur tools.artcocoyrodo.com avec cet e-mail et votre mot de passe. Si vous n'avez pas créé ce compte, vous pouvez ignorer cet e-mail.</p>
{{ else if eq $l "it" }}
  <h2 style="margin:0 0 12px">Conferma il tuo account</h2>
  <p>Ci siamo quasi. Conferma la tua email per attivare il tuo account ART LAB Tools.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Conferma il mio account</a></p>
  <p style="font-size:13px;color:#6B3A55">Poi accedi su tools.artcocoyrodo.com con questa email e la tua password. Se non hai creato questo account, puoi ignorare questa email.</p>
{{ else if eq $l "nl" }}
  <h2 style="margin:0 0 12px">Bevestig je account</h2>
  <p>Bijna klaar. Bevestig je e-mailadres om je ART LAB Tools-account te activeren.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Mijn account bevestigen</a></p>
  <p style="font-size:13px;color:#6B3A55">Log daarna in op tools.artcocoyrodo.com met dit e-mailadres en je wachtwoord. Heb je dit account niet aangemaakt? Dan kun je deze e-mail negeren.</p>
{{ else }}
  <h2 style="margin:0 0 12px">Confirma tu cuenta</h2>
  <p>Ya casi está. Confirma tu correo para activar tu cuenta de ART LAB Tools.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Confirmar mi cuenta</a></p>
  <p style="font-size:13px;color:#6B3A55">Después entra en tools.artcocoyrodo.com con este correo y tu contraseña. Si no creaste esta cuenta, puedes ignorar este correo.</p>
{{ end }}
  <p style="font-size:12px;color:#6B3A55;margin-top:28px">ART LAB · Cocó &amp; Rodo · tools.artcocoyrodo.com</p>
</div>
```

### 3.2 Reset password (Restablecer contraseña)

**Asunto:**
```
{{ $l := printf "%v" .Data.lang }}{{ if eq $l "en" }}Reset your password — ART LAB Tools{{ else if eq $l "pt" }}Redefina sua senha — ART LAB Tools{{ else if eq $l "fr" }}Réinitialisez votre mot de passe — ART LAB Tools{{ else if eq $l "it" }}Reimposta la tua password — ART LAB Tools{{ else if eq $l "nl" }}Stel je wachtwoord opnieuw in — ART LAB Tools{{ else }}Restablece tu contraseña — ART LAB Tools{{ end }}
```
Respaldo: `Restablece tu contraseña · Reset your password — ART LAB Tools`

**Cuerpo:**
```html
{{ $l := printf "%v" .Data.lang }}
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:28px 22px;color:#1A0010;background:#FDF0F7;border-radius:20px">
  <p style="font-size:13px;letter-spacing:2px;color:#CC00A3;font-weight:bold;margin:0 0 18px">ART LAB TOOLS</p>
{{ if eq $l "en" }}
  <h2 style="margin:0 0 12px">Reset your password</h2>
  <p>We received a request to reset the password of your ART LAB Tools account.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Choose a new password</a></p>
  <p style="font-size:13px;color:#6B3A55">If you didn't ask for this, ignore this email: your password stays the same.</p>
{{ else if eq $l "pt" }}
  <h2 style="margin:0 0 12px">Redefina sua senha</h2>
  <p>Recebemos um pedido para redefinir a senha da sua conta do ART LAB Tools.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Escolher nova senha</a></p>
  <p style="font-size:13px;color:#6B3A55">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
{{ else if eq $l "fr" }}
  <h2 style="margin:0 0 12px">Réinitialisez votre mot de passe</h2>
  <p>Nous avons reçu une demande de réinitialisation du mot de passe de votre compte ART LAB Tools.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Choisir un nouveau mot de passe</a></p>
  <p style="font-size:13px;color:#6B3A55">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.</p>
{{ else if eq $l "it" }}
  <h2 style="margin:0 0 12px">Reimposta la tua password</h2>
  <p>Abbiamo ricevuto una richiesta per reimpostare la password del tuo account ART LAB Tools.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Scegli una nuova password</a></p>
  <p style="font-size:13px;color:#6B3A55">Se non sei stata tu, ignora questa email: la tua password resta la stessa.</p>
{{ else if eq $l "nl" }}
  <h2 style="margin:0 0 12px">Stel je wachtwoord opnieuw in</h2>
  <p>We hebben een verzoek ontvangen om het wachtwoord van je ART LAB Tools-account opnieuw in te stellen.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Nieuw wachtwoord kiezen</a></p>
  <p style="font-size:13px;color:#6B3A55">Heb je dit niet aangevraagd? Negeer dan deze e-mail: je wachtwoord blijft hetzelfde.</p>
{{ else }}
  <h2 style="margin:0 0 12px">Restablece tu contraseña</h2>
  <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de ART LAB Tools.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Elegir nueva contraseña</a></p>
  <p style="font-size:13px;color:#6B3A55">Si no lo pediste tú, ignora este correo: tu contraseña sigue igual.</p>
{{ end }}
  <p style="font-size:12px;color:#6B3A55;margin-top:28px">ART LAB · Cocó &amp; Rodo · tools.artcocoyrodo.com</p>
</div>
```

### 3.3 Change email address (Cambiar correo)

**Asunto:**
```
{{ $l := printf "%v" .Data.lang }}{{ if eq $l "en" }}Confirm your new email — ART LAB Tools{{ else if eq $l "pt" }}Confirme seu novo e-mail — ART LAB Tools{{ else if eq $l "fr" }}Confirmez votre nouvel e-mail — ART LAB Tools{{ else if eq $l "it" }}Conferma la tua nuova email — ART LAB Tools{{ else if eq $l "nl" }}Bevestig je nieuwe e-mailadres — ART LAB Tools{{ else }}Confirma tu nuevo correo — ART LAB Tools{{ end }}
```
Respaldo: `Confirma tu nuevo correo · Confirm your new email — ART LAB Tools`

**Cuerpo:**
```html
{{ $l := printf "%v" .Data.lang }}
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:28px 22px;color:#1A0010;background:#FDF0F7;border-radius:20px">
  <p style="font-size:13px;letter-spacing:2px;color:#CC00A3;font-weight:bold;margin:0 0 18px">ART LAB TOOLS</p>
{{ if eq $l "en" }}
  <h2 style="margin:0 0 12px">Confirm your new email</h2>
  <p>You asked to change your ART LAB Tools account email to {{ .NewEmail }}.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Confirm the change</a></p>
  <p style="font-size:13px;color:#6B3A55">If you didn't ask for this, ignore this email: your account keeps its current email.</p>
{{ else if eq $l "pt" }}
  <h2 style="margin:0 0 12px">Confirme seu novo e-mail</h2>
  <p>Você pediu para mudar o e-mail da sua conta do ART LAB Tools para {{ .NewEmail }}.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Confirmar a mudança</a></p>
  <p style="font-size:13px;color:#6B3A55">Se não foi você, ignore este e-mail: sua conta continua com o e-mail de sempre.</p>
{{ else if eq $l "fr" }}
  <h2 style="margin:0 0 12px">Confirmez votre nouvel e-mail</h2>
  <p>Vous avez demandé à changer l'e-mail de votre compte ART LAB Tools pour {{ .NewEmail }}.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Confirmer le changement</a></p>
  <p style="font-size:13px;color:#6B3A55">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre compte garde son e-mail actuel.</p>
{{ else if eq $l "it" }}
  <h2 style="margin:0 0 12px">Conferma la tua nuova email</h2>
  <p>Hai chiesto di cambiare l'email del tuo account ART LAB Tools in {{ .NewEmail }}.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Conferma la modifica</a></p>
  <p style="font-size:13px;color:#6B3A55">Se non sei stata tu, ignora questa email: il tuo account mantiene l'email attuale.</p>
{{ else if eq $l "nl" }}
  <h2 style="margin:0 0 12px">Bevestig je nieuwe e-mailadres</h2>
  <p>Je hebt gevraagd het e-mailadres van je ART LAB Tools-account te wijzigen in {{ .NewEmail }}.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Wijziging bevestigen</a></p>
  <p style="font-size:13px;color:#6B3A55">Heb je dit niet aangevraagd? Negeer dan deze e-mail: je account houdt het huidige e-mailadres.</p>
{{ else }}
  <h2 style="margin:0 0 12px">Confirma tu nuevo correo</h2>
  <p>Pediste cambiar el correo de tu cuenta de ART LAB Tools a {{ .NewEmail }}.</p>
  <p style="margin:26px 0"><a href="{{ .ConfirmationURL }}" style="background:#CC00A3;color:#fff;text-decoration:none;padding:13px 22px;border-radius:30px;font-weight:bold;display:inline-block">Confirmar el cambio</a></p>
  <p style="font-size:13px;color:#6B3A55">Si no lo pediste tú, ignora este correo: tu cuenta sigue con el correo de siempre.</p>
{{ end }}
  <p style="font-size:12px;color:#6B3A55;margin-top:28px">ART LAB · Cocó &amp; Rodo · tools.artcocoyrodo.com</p>
</div>
```

## 4. Cómo probarlo

1. En tools.artcocoyrodo.com elige **English** en el selector y crea una
   cuenta con un correo tuyo de prueba.
2. Debe llegar "Confirm your account — ART LAB Tools" desde
   `noreply@send.artcocoyrodo.com`. En Resend → **Emails** aparece como enviado.
3. Repite con Español y con "Olvidé mi contraseña".
4. Si no llega: revisar Spam/Promociones, Resend → Emails (error) y
   Supabase → Logs → Auth.
