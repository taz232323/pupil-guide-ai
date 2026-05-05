
CREATE TABLE public.personal_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  note TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  kind TEXT NOT NULL DEFAULT 'reminder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own reminders" ON public.personal_reminders
  FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Students insert own reminders" ON public.personal_reminders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students update own reminders" ON public.personal_reminders
  FOR UPDATE TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students delete own reminders" ON public.personal_reminders
  FOR DELETE TO authenticated USING (auth.uid() = student_id);

CREATE TRIGGER personal_reminders_touch_updated_at
  BEFORE UPDATE ON public.personal_reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_personal_reminders_student_start ON public.personal_reminders (student_id, start_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_reminders;
