-- Base de datos de traducciones de ART LAB Tools (como app_translation_cache
-- de la App ART LAB). Una fila por texto en español + idioma destino.
--   origen = 'manual'  → traducción revisada a mano (assets/i18n-dict.js)
--   origen = 'google'  → traducida por Google Cloud Translation la primera
--                        vez que apareció; después se sirve desde aquí.
-- Solo la Edge Function `translate` (service role) lee y escribe esta tabla.
create table if not exists public.translation_cache (
  target      text not null check (target in ('en', 'fr', 'it', 'pt', 'nl')),
  hash        text not null,
  source      text not null,
  translated  text not null,
  origen      text not null default 'google' check (origen in ('manual', 'google')),
  created_at  timestamptz not null default now(),
  primary key (target, hash)
);
alter table public.translation_cache enable row level security;
revoke all on public.translation_cache from anon, authenticated;
