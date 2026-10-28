-- Laboratorio de Instagram: cada análisis que hace la usuaria con su cuenta.
-- Guarda los resultados (indicadores) y la receta para comparar mes a mes.
-- La lectura de Instagram la hace la Edge Function artlab-ig-audit (proyecto ART LAB).
create table if not exists public.instagram_analisis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  audit_id text not null,
  resultados jsonb not null,
  receta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists instagram_analisis_user_idx on public.instagram_analisis (user_id, handle, created_at desc);
alter table public.instagram_analisis enable row level security;
create policy "instagram_analisis propio" on public.instagram_analisis
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
