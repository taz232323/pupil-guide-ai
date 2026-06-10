
CREATE OR REPLACE FUNCTION public.get_student_streaks(_student_ids uuid[])
RETURNS TABLE(student_id uuid, current_streak integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _yesterday date := _today - 1;
  _allowed uuid[];
BEGIN
  IF _user IS NULL OR _student_ids IS NULL THEN RETURN; END IF;

  -- Allowed: students sharing a class with caller, or students in caller's taught classes, plus self
  SELECT array_agg(DISTINCT sid) INTO _allowed FROM (
    SELECT unnest(_student_ids) AS sid
    INTERSECT
    (
      SELECT _user
      UNION
      SELECT cm.student_id
        FROM public.class_members cm
        WHERE cm.class_id IN (SELECT class_id FROM public.class_members WHERE student_id = _user)
      UNION
      SELECT cm.student_id
        FROM public.class_members cm
        JOIN public.classes c ON c.id = cm.class_id
        WHERE c.teacher_id = _user
    )
  ) sub;

  IF _allowed IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT s.student_id,
         COALESCE(MAX(
           CASE WHEN s.last_practice_date IN (_today, _yesterday) THEN s.current_streak ELSE 0 END
         ), 0)::int AS current_streak
  FROM public.daily_practice_streaks s
  WHERE s.student_id = ANY(_allowed)
  GROUP BY s.student_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_student_streaks(uuid[]) TO authenticated;
