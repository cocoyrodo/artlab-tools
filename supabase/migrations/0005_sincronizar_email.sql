-- Cuando la alumna confirma un cambio de correo desde su Perfil,
-- profiles.email se actualiza para que coincida con su cuenta.
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_profile_email();
