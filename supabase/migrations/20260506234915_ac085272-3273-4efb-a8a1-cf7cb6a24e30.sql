CREATE OR REPLACE FUNCTION public.teacher_award_coins(
  _class_id uuid,
  _student_ids uuid[],
  _currency text,
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
  _class_name text;
  _sid uuid;
  _count int := 0;
  _coin_label text;
BEGIN
  IF _teacher IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF _currency NOT IN ('star','crown') THEN
    RAISE EXCEPTION 'Invalid currency';
  END IF;
  IF NOT public.is_class_teacher(_class_id, _teacher) THEN
    RAISE EXCEPTION 'Only the class teacher can award coins';
  END IF;

  SELECT coalesce(nullif(full_name,''),'Your teacher') INTO _teacher_name
    FROM public.profiles WHERE id = _teacher;
  SELECT name INTO _class_name FROM public.classes WHERE id = _class_id;
  _coin_label := CASE WHEN _currency = 'star' THEN 'Star Coin' ELSE 'Crown Coin' END;

  FOREACH _sid IN ARRAY _student_ids LOOP
    IF NOT public.is_class_member(_class_id, _sid) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.student_coins (student_id) VALUES (_sid)
      ON CONFLICT (student_id) DO NOTHING;

    IF _currency = 'star' THEN
      UPDATE public.student_coins
        SET star_coins = star_coins + _amount, updated_at = now()
        WHERE student_id = _sid;
    ELSE
      UPDATE public.student_coins
        SET crown_coins = crown_coins + _amount, updated_at = now()
        WHERE student_id = _sid;
    END IF;

    INSERT INTO public.coin_transactions (student_id, amount, currency, reason, note)
      VALUES (
        _sid,
        _amount,
        _currency,
        'teacher_award',
        coalesce(nullif(btrim(_reason),''), 'Awarded by ' || _teacher_name)
      );

    INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (
        _sid,
        'coin_award',
        _teacher_name || ' awarded you ' || _amount || ' ' || _coin_label ||
          CASE WHEN _amount = 1 THEN '' ELSE 's' END ||
          CASE WHEN nullif(btrim(_reason),'') IS NOT NULL THEN ' — ' || btrim(_reason) ELSE '' END,
        '/student'
      );

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.teacher_award_coins(uuid, uuid[], text, integer, text) TO authenticated;