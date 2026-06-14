CREATE OR REPLACE FUNCTION public.auto_apply_streak_shields(_class_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _yesterday date := ((now() AT TIME ZONE 'utc')::date - 1);
  _streak record;
  _missing date[];
  _missing_count int;
  _active_count int;
  _needed_inventory int;
  _balance int;
  _consumed_active int;
  _auto_created int;
  _next_current int;
  _cursor date;
  _total_consumed int := 0;
  _applied jsonb := '[]'::jsonb;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(_user, 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Only students can use streak shields';
  END IF;

  INSERT INTO public.student_coins (student_id)
    VALUES (_user)
    ON CONFLICT (student_id) DO NOTHING;

  FOR _streak IN
    SELECT ds.*
    FROM public.daily_practice_streaks ds
    JOIN public.classes c ON c.id = ds.class_id
    WHERE ds.student_id = _user
      AND c.daily_practice_enabled = true
      AND (_class_id IS NULL OR ds.class_id = _class_id)
    FOR UPDATE OF ds
  LOOP
    IF _streak.last_practice_date IS NULL OR _streak.last_practice_date >= _yesterday THEN
      CONTINUE;
    END IF;

    SELECT array_agg(day::date ORDER BY day::date)
      INTO _missing
    FROM generate_series(
      (_streak.last_practice_date + 1)::timestamp,
      _yesterday::timestamp,
      interval '1 day'
    ) AS day;

    _missing_count := COALESCE(array_length(_missing, 1), 0);
    IF _missing_count = 0 THEN
      CONTINUE;
    END IF;

    SELECT count(*)::int
      INTO _active_count
    FROM public.streak_freeze_activations
    WHERE student_id = _user
      AND class_id = _streak.class_id
      AND consumed = false
      AND shield_date = ANY(_missing);

    _needed_inventory := _missing_count - COALESCE(_active_count, 0);

    SELECT streak_freezes
      INTO _balance
    FROM public.student_coins
    WHERE student_id = _user
    FOR UPDATE;

    -- If the whole gap cannot be covered, do not waste partial shields.
    IF COALESCE(_balance, 0) < _needed_inventory THEN
      CONTINUE;
    END IF;

    UPDATE public.streak_freeze_activations
      SET consumed = true,
          consumed_at = now()
    WHERE student_id = _user
      AND class_id = _streak.class_id
      AND consumed = false
      AND shield_date = ANY(_missing);
    GET DIAGNOSTICS _consumed_active = ROW_COUNT;

    _auto_created := 0;
    FOREACH _cursor IN ARRAY _missing LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.streak_freeze_activations
        WHERE student_id = _user
          AND class_id = _streak.class_id
          AND shield_date = _cursor
      ) THEN
        INSERT INTO public.streak_freeze_activations (
          student_id,
          class_id,
          shield_date,
          consumed,
          consumed_at
        )
        VALUES (_user, _streak.class_id, _cursor, true, now());
        _auto_created := _auto_created + 1;
      END IF;
    END LOOP;

    IF _needed_inventory > 0 THEN
      UPDATE public.student_coins
        SET streak_freezes = streak_freezes - _needed_inventory,
            updated_at = now()
      WHERE student_id = _user;
    END IF;

    _next_current := COALESCE(_streak.current_streak, 0) + _missing_count;

    UPDATE public.daily_practice_streaks
      SET current_streak = _next_current,
          longest_streak = GREATEST(COALESCE(longest_streak, 0), _next_current),
          last_practice_date = _yesterday,
          updated_at = now()
    WHERE id = _streak.id;

    _total_consumed := _total_consumed + _missing_count;
    _applied := _applied || jsonb_build_array(jsonb_build_object(
      'class_id', _streak.class_id,
      'missed_days', _missing_count,
      'active_shields_consumed', COALESCE(_consumed_active, 0),
      'inventory_shields_consumed', COALESCE(_auto_created, 0),
      'current_streak', _next_current
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'shieldsConsumed', _total_consumed,
    'classes', _applied
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_apply_streak_shields(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_apply_streak_shields(uuid) TO authenticated;

SELECT public.reload_schema_cache();
NOTIFY pgrst, 'reload schema';
