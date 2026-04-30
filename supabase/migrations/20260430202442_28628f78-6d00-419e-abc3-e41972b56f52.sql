GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_message(uuid, uuid, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role()         TO authenticated;