-- Contenido: guiones, ganchos y calendario de Reels con IA (Edge Function contenido-ia).
-- Cada usuaria ve solo lo suyo. Los créditos y las piezas generadas los escribe
-- solo la Edge Function (service_role); desde el navegador son de solo lectura.

-- Perfil de marca: de qué trata su negocio y cómo habla (la IA escribe con esto)
create table if not exists public.contenido_perfil (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rubro text not null default '',
  negocio text not null default '',
  oferta text not null default '',
  publico text not null default '',
  tono text not null default '',
  instagram text not null default '',
  voz text not null default '',            -- textos reales suyos (captions) para imitar su forma de escribir
  updated_at timestamptz not null default now()
);
alter table public.contenido_perfil enable row level security;
create policy "contenido_perfil propio" on public.contenido_perfil
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lo que la IA generó: un guion, una lista de ganchos o un calendario
create table if not exists public.contenido_piezas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('guion', 'ganchos', 'calendario')),
  pedido text not null default '',
  resultado jsonb not null,
  creditos int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists contenido_piezas_user_idx on public.contenido_piezas (user_id, created_at desc);
alter table public.contenido_piezas enable row level security;
create policy "contenido_piezas ver propias" on public.contenido_piezas
  for select to authenticated using (user_id = auth.uid());
create policy "contenido_piezas borrar propias" on public.contenido_piezas
  for delete to authenticated using (user_id = auth.uid());

-- Créditos: saldo actual. Beta: cada cuenta parte con 20.
create table if not exists public.contenido_creditos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  saldo int not null default 20 check (saldo >= 0),
  plan text not null default 'beta',
  updated_at timestamptz not null default now()
);
alter table public.contenido_creditos enable row level security;
create policy "contenido_creditos ver propios" on public.contenido_creditos
  for select to authenticated using (user_id = auth.uid());

-- Descuenta n créditos si alcanza (atómico). Crea la fila de la beta la primera vez.
-- Devuelve el saldo que queda, o -1 si no alcanzó.
create or replace function public.contenido_cobrar(p_user uuid, p_n int)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into contenido_creditos (user_id) values (p_user) on conflict (user_id) do nothing;
  update contenido_creditos set saldo = saldo - p_n, updated_at = now()
    where user_id = p_user and saldo >= p_n
    returning saldo into v;
  return coalesce(v, -1);
end $$;

-- Devuelve créditos cuando la IA falla después de cobrar
create or replace function public.contenido_devolver(p_user uuid, p_n int)
returns void language sql security definer set search_path = public as $$
  update contenido_creditos set saldo = saldo + p_n, updated_at = now() where user_id = p_user;
$$;

revoke all on function public.contenido_cobrar(uuid, int) from public, anon, authenticated;
revoke all on function public.contenido_devolver(uuid, int) from public, anon, authenticated;
grant execute on function public.contenido_cobrar(uuid, int) to service_role;
grant execute on function public.contenido_devolver(uuid, int) to service_role;
