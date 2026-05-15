REVOKE EXECUTE ON FUNCTION public.claim_daily_login_box() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.activate_streak_shield(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_quests_progress() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_quest(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_login_box() TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_streak_shield(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quests_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quest(text) TO authenticated;