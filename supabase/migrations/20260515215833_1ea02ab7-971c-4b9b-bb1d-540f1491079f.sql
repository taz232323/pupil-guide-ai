-- 1) Inventory column for streak shields
ALTER TABLE public.student_coins
  ADD COLUMN IF NOT EXISTS streak_freezes integer NOT NULL DEFAULT 0;

-- 2) Daily login box claims
CREATE TABLE IF NOT EXISTS public.daily_login_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  claim_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  reward_kind text NOT NULL,
  coins_amount integer NOT NULL DEFAULT 0,
  freezes_amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, claim_date)
);
ALTER TABLE public.daily_login_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own login claims"
  ON public.daily_login_claims FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- 3) Streak shield activations
CREATE TABLE IF NOT EXISTS public.streak_freeze_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  shield_date date NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id, shield_date)
);
ALTER TABLE public.streak_freeze_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own shields"
  ON public.streak_freeze_activations FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- 4) Quests catalog (weekly + ongoing)
CREATE TABLE IF NOT EXISTS public.quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('weekly','ongoing')),
  goal_type text NOT NULL CHECK (goal_type IN ('submit_assignments','practice_sessions','correct_answers','modules_completed','login_days')),
  goal_value integer NOT NULL CHECK (goal_value > 0),
  reward_coins integer NOT NULL DEFAULT 0,
  reward_freezes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated views active quests"
  ON public.quests FOR SELECT TO authenticated
  USING (active = true);

-- 5) Quest claims
CREATE TABLE IF NOT EXISTS public.student_quest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  quest_key text NOT NULL,
  period_key text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  reward_coins integer NOT NULL DEFAULT 0,
  reward_freezes integer NOT NULL DEFAULT 0,
  UNIQUE (student_id, quest_key, period_key)
);
ALTER TABLE public.student_quest_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own quest claims"
  ON public.student_quest_claims FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- 6) Daily login surprise box (random reward)
CREATE OR REPLACE FUNCTION public.claim_daily_login_box()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _existing public.daily_login_claims;
  _r double precision;
  _kind text;
  _coins int := 0;
  _freezes int := 0;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(_user, 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Only students can claim';
  END IF;

  SELECT * INTO _existing FROM public.daily_login_claims
   WHERE student_id = _user AND claim_date = _today;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'alreadyClaimed', true,
      'kind', _existing.reward_kind,
      'coins', _existing.coins_amount,
      'freezes', _existing.freezes_amount
    );
  END IF;

  _r := random();
  IF _r < 0.01 THEN
    _kind := 'freeze'; _freezes := 1;
  ELSIF _r < 0.05 THEN
    _kind := 'big_coins'; _coins := 75 + floor(random() * 76)::int;
  ELSIF _r < 0.30 THEN
    _kind := 'medium_coins'; _coins := 20 + floor(random() * 31)::int;
  ELSE
    _kind := 'small_coins'; _coins := 5 + floor(random() * 11)::int;
  END IF;

  INSERT INTO public.daily_login_claims (student_id, claim_date, reward_kind, coins_amount, freezes_amount)
  VALUES (_user, _today, _kind, _coins, _freezes);

  INSERT INTO public.student_coins (student_id) VALUES (_user) ON CONFLICT DO NOTHING;
  UPDATE public.student_coins
    SET star_coins = star_coins + _coins,
        streak_freezes = streak_freezes + _freezes,
        updated_at = now()
    WHERE student_id = _user;

  IF _coins > 0 THEN
    INSERT INTO public.coin_transactions (student_id, amount, currency, reason, note)
    VALUES (_user, _coins, 'star', 'daily_login', 'Daily login surprise box');
  END IF;

  RETURN jsonb_build_object(
    'alreadyClaimed', false,
    'kind', _kind,
    'coins', _coins,
    'freezes', _freezes
  );
END; $$;

-- 7) Activate streak shield (manual)
CREATE OR REPLACE FUNCTION public.activate_streak_shield(_class_id uuid, _shield_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _balance int;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_class_member(_class_id, _user) THEN
    RAISE EXCEPTION 'Not a member of this class';
  END IF;
  IF _shield_date < _today THEN
    RAISE EXCEPTION 'Cannot shield a past day';
  END IF;
  IF _shield_date > _today + INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Shield can only be set up to 7 days ahead';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.streak_freeze_activations
    WHERE student_id = _user AND class_id = _class_id AND shield_date = _shield_date
  ) THEN
    RAISE EXCEPTION 'A shield is already active for this day';
  END IF;

  SELECT streak_freezes INTO _balance FROM public.student_coins
    WHERE student_id = _user FOR UPDATE;
  IF _balance IS NULL OR _balance < 1 THEN
    RAISE EXCEPTION 'No streak shields available';
  END IF;

  UPDATE public.student_coins
    SET streak_freezes = streak_freezes - 1, updated_at = now()
    WHERE student_id = _user;
  INSERT INTO public.streak_freeze_activations (student_id, class_id, shield_date)
    VALUES (_user, _class_id, _shield_date);

  RETURN jsonb_build_object('ok', true, 'remaining', _balance - 1);
END; $$;

-- 8) Live quest progress
CREATE OR REPLACE FUNCTION public.get_quests_progress()
RETURNS TABLE (
  quest_key text,
  title text,
  description text,
  kind text,
  goal_type text,
  goal_value int,
  reward_coins int,
  reward_freezes int,
  period_key text,
  progress int,
  claimed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _week_start date := (date_trunc('week', _today::timestamp))::date;
  _week_key text := to_char(_week_start, 'IYYY-"W"IW');
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    q.quest_key, q.title, q.description, q.kind, q.goal_type, q.goal_value,
    q.reward_coins, q.reward_freezes,
    CASE WHEN q.kind = 'weekly' THEN _week_key ELSE '' END AS period_key,
    CASE q.goal_type
      WHEN 'submit_assignments' THEN
        COALESCE((SELECT count(*)::int FROM public.submissions s
          WHERE s.student_id = _user
            AND (q.kind <> 'weekly' OR s.submitted_at >= _week_start::timestamptz)), 0)
      WHEN 'practice_sessions' THEN
        COALESCE((SELECT count(*)::int FROM public.daily_practice_sessions ds
          WHERE ds.student_id = _user AND ds.status = 'submitted'
            AND (q.kind <> 'weekly' OR ds.practice_date >= _week_start)), 0)
      WHEN 'correct_answers' THEN
        COALESCE((SELECT count(*)::int FROM public.daily_practice_answers da
          JOIN public.daily_practice_sessions ds ON ds.id = da.session_id
          WHERE da.student_id = _user AND da.is_correct = true
            AND (q.kind <> 'weekly' OR ds.practice_date >= _week_start)), 0)
      WHEN 'modules_completed' THEN
        COALESCE((SELECT count(*)::int FROM public.module_item_completions mc
          WHERE mc.student_id = _user
            AND (q.kind <> 'weekly' OR mc.completed_at >= _week_start::timestamptz)), 0)
      WHEN 'login_days' THEN
        COALESCE((SELECT count(*)::int FROM public.daily_login_claims dlc
          WHERE dlc.student_id = _user
            AND (q.kind <> 'weekly' OR dlc.claim_date >= _week_start)), 0)
      ELSE 0
    END AS progress,
    EXISTS (
      SELECT 1 FROM public.student_quest_claims c
      WHERE c.student_id = _user AND c.quest_key = q.quest_key
        AND c.period_key = CASE WHEN q.kind = 'weekly' THEN _week_key ELSE '' END
    ) AS claimed
  FROM public.quests q
  WHERE q.active = true;
END; $$;

-- 9) Claim a completed quest
CREATE OR REPLACE FUNCTION public.claim_quest(_quest_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _row record;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _row FROM public.get_quests_progress() WHERE quest_key = _quest_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quest not found'; END IF;
  IF _row.claimed THEN RAISE EXCEPTION 'Already claimed'; END IF;
  IF _row.progress < _row.goal_value THEN RAISE EXCEPTION 'Quest not complete'; END IF;

  INSERT INTO public.student_quest_claims (student_id, quest_key, period_key, reward_coins, reward_freezes)
    VALUES (_user, _quest_key, _row.period_key, _row.reward_coins, _row.reward_freezes);

  INSERT INTO public.student_coins (student_id) VALUES (_user) ON CONFLICT DO NOTHING;
  UPDATE public.student_coins
    SET star_coins = star_coins + _row.reward_coins,
        streak_freezes = streak_freezes + _row.reward_freezes,
        updated_at = now()
    WHERE student_id = _user;

  IF _row.reward_coins > 0 THEN
    INSERT INTO public.coin_transactions (student_id, amount, currency, reason, note)
    VALUES (_user, _row.reward_coins, 'star', 'quest_reward', 'Quest: ' || _row.title);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'coins', _row.reward_coins,
    'freezes', _row.reward_freezes,
    'title', _row.title
  );
END; $$;

-- 10) Seed quests catalog
INSERT INTO public.quests (quest_key, title, description, kind, goal_type, goal_value, reward_coins, reward_freezes) VALUES
  ('weekly_submit_3',     'Turn it in',        'Submit 3 assignments this week',                'weekly',  'submit_assignments', 3,  50, 0),
  ('weekly_practice_5',   'Practice marathon', 'Complete 5 daily practice sessions this week',  'weekly',  'practice_sessions',  5,  75, 1),
  ('weekly_correct_20',   'Sharp shooter',     'Get 20 correct practice answers this week',     'weekly',  'correct_answers',    20, 60, 0),
  ('weekly_modules_5',    'Module marauder',   'Finish 5 module items this week',               'weekly',  'modules_completed',  5,  40, 0),
  ('weekly_login_7',      'Show up',           'Open the daily reward box 7 days this week',    'weekly',  'login_days',         7, 100, 1),
  ('ongoing_first_submit','First steps',       'Submit your very first assignment',             'ongoing', 'submit_assignments', 1,  25, 0),
  ('ongoing_practice_50', 'Dedicated',         'Complete 50 daily practice sessions in total',  'ongoing', 'practice_sessions',  50,200, 1),
  ('ongoing_correct_200', 'Precision',         'Answer 200 practice questions correctly',       'ongoing', 'correct_answers',   200,150, 0)
ON CONFLICT (quest_key) DO NOTHING;