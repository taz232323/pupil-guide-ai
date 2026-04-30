REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_student_coins()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_submission()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_shop_purchase()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_shop_purchase_resolution()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_coins_on_submission()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_shop_purchase_canonical()       FROM PUBLIC, anon, authenticated;