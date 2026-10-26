-- ART LAB Tools — esquema base + herramienta Finanzas
-- Proyecto Supabase: psljtvkwhenjvbinrowk (artlab-tools)
-- Cada fila pertenece a una alumna (auth.users) y RLS impide ver datos ajenos.

-- Perfil compartido por todas las herramientas
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text,
  negocio     text,
  moneda      text not null default 'CLP',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: leer el propio" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: crear el propio" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: editar el propio" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Movimientos financieros
--   venta  = ingreso por un servicio/producto (cobrada o pendiente de cobro)
--   costo  = material/insumo directo de un servicio
--   gasto  = gasto del negocio (arriendo, publicidad, transporte...)
-- Un cobro NO es un movimiento nuevo: es una venta que pasa a estado 'pagado'.
-- Así una venta nunca se cuenta dos veces.
create table if not exists public.fin_movements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo         text not null check (tipo in ('venta', 'costo', 'gasto')),
  monto        numeric(14, 2) not null check (monto > 0),
  fecha        date not null default current_date,
  categoria    text,
  descripcion  text,
  servicio     text,
  estado       text not null default 'pagado' check (estado in ('pagado', 'pendiente')),
  fecha_pago   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists fin_movements_user_fecha_idx
  on public.fin_movements (user_id, fecha desc);

alter table public.fin_movements enable row level security;

create policy "fin: leer los propios" on public.fin_movements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "fin: crear los propios" on public.fin_movements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "fin: editar los propios" on public.fin_movements
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "fin: borrar los propios" on public.fin_movements
  for delete to authenticated using ((select auth.uid()) = user_id);

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger fin_movements_touch before update on public.fin_movements
  for each row execute function public.touch_updated_at();

-- Resumen mensual. security_invoker hace que la vista respete el RLS de quien consulta.
create or replace view public.fin_resumen_mensual
with (security_invoker = true) as
select
  user_id,
  date_trunc('month', fecha)::date                                              as mes,
  coalesce(sum(monto) filter (where tipo = 'venta'), 0)                          as ventas,
  coalesce(sum(monto) filter (where tipo = 'venta' and estado = 'pendiente'), 0) as por_cobrar,
  coalesce(sum(monto) filter (where tipo = 'costo'), 0)                          as costos,
  coalesce(sum(monto) filter (where tipo = 'gasto'), 0)                          as gastos,
  coalesce(sum(monto) filter (where tipo in ('costo', 'gasto') and estado = 'pendiente'), 0) as por_pagar,
  coalesce(sum(monto) filter (where tipo = 'venta'), 0)
    - coalesce(sum(monto) filter (where tipo in ('costo', 'gasto')), 0)          as ganancia_estimada
from public.fin_movements
group by user_id, date_trunc('month', fecha);
