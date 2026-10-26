-- Limpieza de la app antigua (Parametrización/LifeOS) en el proyecto reutilizado.
-- Auditado el 2026-10-26: todas las tablas con 0 filas y 0 usuarios en auth.
-- La única fila existente (server_config.anthropic_api_key) ya fue borrada.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.use_credit cascade;
drop table if exists public.ai_usage, public.folders, public.projects,
  public.subscriptions, public.server_config, public.profiles cascade;
