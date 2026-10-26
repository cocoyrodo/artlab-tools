-- Datos del registro, iguales a los del formulario de la App ART LAB:
-- red social, país, WhatsApp y consentimiento para recibir novedades.
alter table public.profiles
  add column if not exists email text,
  add column if not exists red_social text,
  add column if not exists pais text,
  add column if not exists pais_iso text,
  add column if not exists whatsapp text,
  add column if not exists acepta_novedades boolean not null default false,
  add column if not exists acepta_novedades_at timestamptz;

-- El perfil se llena con los datos que la alumna escribió al registrarse.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  acepta boolean := coalesce((m ->> 'acepta_novedades')::boolean, false);
begin
  insert into public.profiles (id, email, nombre, red_social, pais, pais_iso, whatsapp, acepta_novedades, acepta_novedades_at)
  values (
    new.id,
    new.email,
    left(coalesce(m ->> 'nombre', ''), 80),
    left(nullif(m ->> 'red_social', ''), 80),
    left(nullif(m ->> 'pais', ''), 60),
    left(nullif(m ->> 'pais_iso', ''), 2),
    left(nullif(m ->> 'whatsapp', ''), 32),
    acepta,
    case when acepta then now() end
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
