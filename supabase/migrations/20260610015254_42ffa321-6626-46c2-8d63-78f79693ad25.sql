
CREATE OR REPLACE FUNCTION public.auto_apply_streak_shields()
RETURNS TABLE(class_id uuid, class_name text, shields_used integer, current_streak integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _rec record;
  _balance int;
  _used int;
  _missed_weekdays date[];
  _d date;
BEGIN
  IF _user IS NULL THEN RETURN; END IF;

  SELECT streak_freezes INTO _balance FROM public.student_coins
    WHERE student_id = _user FOR UPDATE;
  IF _balance IS NULL THEN _balance := 0; END IF;
  IF _balance <= 0 THEN RETURN; END IF;

  FOR _rec IN
    SELECT s.class_id AS cid, c.name AS cname,
           s.last_practice_date AS lpd, s.current_streak AS streak
    FROM public.daily_practice_streaks s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.student_id = _user
      AND s.current_streak > 0
      AND s.last_practice_date IS NOT NULL
      AND s.last_practice_date < (_today - INTERVAL '1 day')::date
  LOOP
    -- Collect missed WEEKDAYS strictly between lpd and today (exclusive of today)
    _missed_weekdays := ARRAY[]::date[];
    _d := _rec.lpd + 1;
    WHILE _d < _today LOOP
      IF extract(isodow FROM _d) < 6 THEN -- Mon..Fri
        _missed_weekdays := array_append(_missed_weekdays, _d);
      END IF;
      _d := _d + 1;
    END LOOP;

    IF array_length(_missed_weekdays, 1) IS NULL THEN
      -- Only weekend days were "missed"; treat as continuous, just bump last_practice_date.
      UPDATE public.daily_practice_streaks
        SET last_practice_date = (_today - 1)::date, updated_at = now()
        WHERE student_id = _user AND class_id = _rec.cid;
      CONTINUE;
    END IF;

    IF array_length(_missed_weekdays, 1) > _balance THEN
      CONTINUE; -- not enough shields to cover all missed weekdays
    END IF;

    _used := 0;
    FOREACH _d IN ARRAY _missed_weekdays LOOP
      INSERT INTO public.streak_freeze_activations
        (student_id, class_id, shield_date, consumed, consumed_at)
      VALUES (_user, _rec.cid, _d, true, now());
      _used := _used + 1;
    END LOOP;

    _balance := _balance - _used;

    UPDATE public.daily_practice_streaks
      SET last_practice_date = (_today - 1)::date, updated_at = now()
      WHERE student_id = _user AND class_id = _rec.cid;

    UPDATE public.student_coins
      SET streak_freezes = _balance, updated_at = now()
      WHERE student_id = _user;

    class_id := _rec.cid;
    class_name := _rec.cname;
    shields_used := _used;
    current_streak := _rec.streak;
    RETURN NEXT;

    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      _user,
      'shield_used',
      'Your Streak Shield protected your ' || _rec.streak || '-day streak in ' || _rec.cname || '!',
      '/student'
    );

    IF _balance <= 0 THEN EXIT; END IF;
  END LOOP;
END;
$$;
