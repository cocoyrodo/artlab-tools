-- handle_new_user es solo para el trigger de registro: no debe poder
-- llamarse por la API (/rest/v1/rpc). Recomendación del Security Advisor.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
