
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS inapp_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_reminders_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.assignment_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  kind text NOT NULL,
  channel text NOT NULL DEFAULT 'inapp',
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id, kind, channel)
);

ALTER TABLE public.assignment_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own reminder log"
  ON public.assignment_reminder_log FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Teachers view reminder log for own assignments"
  ON public.assignment_reminder_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a
                 WHERE a.id = assignment_reminder_log.assignment_id
                   AND a.teacher_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_reminder_log_assignment ON public.assignment_reminder_log(assignment_id);
