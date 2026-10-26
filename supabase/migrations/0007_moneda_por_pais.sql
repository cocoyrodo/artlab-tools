-- La moneda se elige sola según el país de la alumna. Si ella elige una a mano
-- (moneda_manual = true) se respeta; "Automática" vuelve a usar la del país.
create or replace function public.moneda_por_pais(iso text)
returns text language sql immutable set search_path = '' as $$
  select case upper(coalesce(iso, ''))
    when 'AR' then 'ARS' when 'BO' then 'BOB' when 'BR' then 'BRL' when 'CA' then 'CAD'
    when 'CL' then 'CLP' when 'CO' then 'COP' when 'CR' then 'CRC' when 'CU' then 'CUP'
    when 'EC' then 'USD' when 'SV' then 'USD' when 'ES' then 'EUR' when 'US' then 'USD'
    when 'FR' then 'EUR' when 'GT' then 'GTQ' when 'HN' then 'HNL' when 'IT' then 'EUR'
    when 'MX' then 'MXN' when 'NI' then 'NIO' when 'PA' then 'USD' when 'PY' then 'PYG'
    when 'PE' then 'PEN' when 'PT' then 'EUR' when 'PR' then 'USD' when 'GB' then 'GBP'
    when 'DO' then 'DOP' when 'CH' then 'CHF' when 'UY' then 'UYU' when 'VE' then 'USD'
    when 'NL' then 'EUR' when 'BE' then 'EUR' when 'DE' then 'EUR'
    else 'USD'
  end;
$$;

alter table public.profiles add column if not exists moneda_manual boolean not null default false;

-- Al crear el perfil (registro) y al cambiar de país, la moneda sigue al país
create or replace function public.profiles_moneda_auto()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not new.moneda_manual and (
       tg_op = 'INSERT'
       or new.pais_iso is distinct from old.pais_iso
       or (old.moneda_manual and not new.moneda_manual)
     ) and new.pais_iso is not null then
    new.moneda := public.moneda_por_pais(new.pais_iso);
  end if;
  return new;
end;
$$;

create trigger profiles_moneda_auto
  before insert or update on public.profiles
  for each row execute function public.profiles_moneda_auto();

-- Cuentas existentes: la de la simulación en USD queda como elección manual;
-- las demás toman la moneda de su país.
update public.profiles set moneda_manual = true where moneda <> public.moneda_por_pais(pais_iso) and moneda <> 'CLP';
update public.profiles set moneda = public.moneda_por_pais(pais_iso) where not moneda_manual and pais_iso is not null;
