-- Toggle on classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS daily_practice_enabled boolean NOT NULL DEFAULT false;

-- Sessions
CREATE TABLE IF NOT EXISTS public.daily_practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  practice_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  status text NOT NULL DEFAULT 'in_progress', -- in_progress | submitted
  total_answered int NOT NULL DEFAULT 0,
  total_correct int NOT NULL DEFAULT 0,
  coins_awarded int NOT NULL DEFAULT 0,
  bonus_coins_awarded int NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id, practice_date)
);

ALTER TABLE public.daily_practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own practice sessions"
  ON public.daily_practice_sessions FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id AND public.is_class_member(class_id, auth.uid()));

CREATE POLICY "Teachers view practice sessions in own classes"
  ON public.daily_practice_sessions FOR SELECT TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()));

CREATE TRIGGER touch_daily_practice_sessions
  BEFORE UPDATE ON public.daily_practice_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Answers
CREATE TABLE IF NOT EXISTS public.daily_practice_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.daily_practice_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  position int NOT NULL,
  question_type text NOT NULL, -- multiple_choice | short_answer
  prompt text NOT NULL,
  options jsonb,
  correct_index int,
  expected_answer text,
  selected_index int,
  text_response text,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_practice_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own practice answers"
  ON public.daily_practice_answers FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers view practice answers in own classes"
  ON public.daily_practice_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.daily_practice_sessions s
    WHERE s.id = daily_practice_answers.session_id
      AND public.is_class_teacher(s.class_id, auth.uid())
  ));

-- Streaks
CREATE TABLE IF NOT EXISTS public.daily_practice_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_practice_date date,
  milestones_awarded int[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id)
);

ALTER TABLE public.daily_practice_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own streaks"
  ON public.daily_practice_streaks FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Teachers view streaks in own classes"
  ON public.daily_practice_streaks FOR SELECT TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()));

CREATE TRIGGER touch_daily_practice_streaks
  BEFORE UPDATE ON public.daily_practice_streaks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_dp_sessions_student_class ON public.daily_practice_sessions(student_id, class_id, practice_date);
CREATE INDEX IF NOT EXISTS idx_dp_answers_session ON public.daily_practice_answers(session_id, position);