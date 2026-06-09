CREATE OR REPLACE FUNCTION public.teacher_award_streak_shields(
  _class_id uuid,
  _student_ids uuid[],
  _amount integer,
  _reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _teacher uuid := auth.uid();
  _teacher_name text;
  _sid uuid;
  _count int := 0;
BEGIN
  IF _teacher IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF NOT public.is_class_teacher(_class_id, _teacher) THEN
    RAISE EXCEPTION 'Only the class teacher can award streak shields';
  END IF;

  SELECT coalesce(nullif(full_name, ''), 'Your teacher') INTO _teacher_name
    FROM public.profiles WHERE id = _teacher;

  FOREACH _sid IN ARRAY _student_ids LOOP
    IF NOT public.is_class_member(_class_id, _sid) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.student_coins (student_id) VALUES (_sid)
      ON CONFLICT (student_id) DO NOTHING;

    UPDATE public.student_coins
      SET streak_freezes = streak_freezes + _amount,
          updated_at = now()
      WHERE student_id = _sid;

    INSERT INTO public.coin_transactions (student_id, amount, currency, reason, note)
      VALUES (
        _sid,
        _amount,
        'shield',
        'teacher_shield_award',
        coalesce(nullif(btrim(_reason), ''), 'Awarded by ' || _teacher_name)
      );

    INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (
        _sid,
        'streak_shield_award',
        _teacher_name || ' gave you ' || _amount || ' Streak Shield' ||
          CASE WHEN _amount = 1 THEN '' ELSE 's' END ||
          CASE WHEN nullif(btrim(_reason), '') IS NOT NULL THEN ' — ' || btrim(_reason) ELSE '' END,
        '/student/rewards'
      );

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_award_streak_shields(uuid, uuid[], integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_award_streak_shields(uuid, uuid[], integer, text) TO authenticated;

SELECT public.reload_schema_cache();
NOTIFY pgrst, 'reload schema';
