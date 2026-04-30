
CREATE TABLE public.ai_coin_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  coins_awarded int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_coin_awards_student_day ON public.ai_coin_awards (student_id, created_at);

ALTER TABLE public.ai_coin_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their own AI awards"
  ON public.ai_coin_awards FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Inserts only happen via the edge function using the service role, so no INSERT policy for clients.

CREATE OR REPLACE FUNCTION public.award_ai_message_coins(_student_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today_count int;
  _daily_cap constant int := 5;
  _award constant int := 10;
BEGIN
  SELECT count(*) INTO _today_count
    FROM public.ai_coin_awards
    WHERE student_id = _student_id
      AND created_at >= (now() - interval '24 hours');

  IF _today_count >= _daily_cap THEN
    RETURN 0;
  END IF;

  INSERT INTO public.ai_coin_awards (student_id, coins_awarded) VALUES (_student_id, _award);

  INSERT INTO public.student_coins (student_id, star_coins)
    VALUES (_student_id, _award)
  ON CONFLICT (student_id) DO UPDATE
    SET star_coins = public.student_coins.star_coins + _award,
        updated_at = now();

  RETURN _award;
END;
$$;
