revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.get_current_user_role() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;