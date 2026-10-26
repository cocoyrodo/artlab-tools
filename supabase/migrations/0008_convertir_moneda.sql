-- Cambiar de moneda convirtiendo los montos con un tipo de cambio.
-- Todo en una transacción y solo sobre los datos de quien la llama (RLS).

-- Historial de conversiones, para poder revisarlas
create table if not exists public.fin_conversiones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  de          text not null,
  a           text not null,
  tasa        numeric(20, 8) not null check (tasa > 0),
  movimientos integer not null,
  created_at  timestamptz not null default now()
);
alter table public.fin_conversiones enable row level security;
create policy "conversiones: leer las propias" on public.fin_conversiones
  for select to authenticated using ((select auth.uid()) = user_id);

-- Monedas que no usan decimales
create or replace function public.decimales_moneda(m text)
returns integer language sql immutable set search_path = '' as $$
  select case upper(m) when 'CLP' then 0 when 'PYG' then 0 when 'COP' then 0 when 'CRC' then 0 else 2 end;
$$;

-- p_tasa: cuántas unidades de la moneda nueva vale 1 unidad de la actual.
-- p_tasa null = solo cambia la moneda, sin tocar los montos.
-- p_manual: false = queda en "Automática" (la moneda del país).
create or replace function public.convertir_moneda(p_moneda text, p_tasa numeric, p_manual boolean)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  actual text;
  dec integer := public.decimales_moneda(p_moneda);
  minimo numeric := case when public.decimales_moneda(p_moneda) = 0 then 1 else 0.01 end;
  n integer;
begin
  if uid is null then raise exception 'Sin sesión'; end if;
  if p_tasa is not null and p_tasa <= 0 then raise exception 'Tasa inválida'; end if;
  select moneda into actual from public.profiles where id = uid;

  if p_tasa is not null and actual is distinct from p_moneda then
    update public.fin_movements
      set monto = greatest(round(monto * p_tasa, dec), minimo),
          precio_cliente = case when precio_cliente is null then null
                                else greatest(round(precio_cliente * p_tasa, dec), minimo) end
      where user_id = uid;
    get diagnostics n = row_count;
    insert into public.fin_conversiones (user_id, de, a, tasa, movimientos) values (uid, actual, p_moneda, p_tasa, n);
  end if;

  update public.profiles set moneda = p_moneda, moneda_manual = p_manual where id = uid;
  return p_moneda;
end;
$$;
revoke execute on function public.convertir_moneda(text, numeric, boolean) from public, anon;
grant execute on function public.convertir_moneda(text, numeric, boolean) to authenticated;

-- convertir_moneda corre con los permisos de la alumna: necesita poder registrar su conversión
create policy "conversiones: crear las propias" on public.fin_conversiones
  for insert to authenticated with check ((select auth.uid()) = user_id);
