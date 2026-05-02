-- Assignment questions
CREATE TYPE public.question_type AS ENUM ('multiple_choice', 'short_answer', 'long_answer');

CREATE TABLE public.assignment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  question_type public.question_type NOT NULL,
  prompt text NOT NULL,
  options jsonb,                -- for MC: array of strings
  correct_index int,            -- for MC: index of correct option
  max_score int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignment_questions_assignment ON public.assignment_questions(assignment_id, position);

ALTER TABLE public.assignment_questions ENABLE ROW LEVEL SECURITY;

-- Teachers manage questions on their own assignments
CREATE POLICY "Teachers manage questions on own assignments"
ON public.assignment_questions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_questions.assignment_id AND a.teacher_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_questions.assignment_id AND a.teacher_id = auth.uid()));

-- Students view questions on assignments in classes they belong to
CREATE POLICY "Students view questions in joined classes"
ON public.assignment_questions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_questions.assignment_id AND public.is_class_member(a.class_id, auth.uid())
));

-- Student answers
CREATE TABLE public.assignment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.assignment_questions(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  selected_index int,            -- for MC
  text_response text,            -- for short/long
  is_correct boolean,            -- auto-graded MC
  score int,                     -- teacher score
  feedback text,                 -- per-question feedback
  graded_at timestamptz,
  graded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(question_id, student_id)
);

CREATE INDEX idx_assignment_answers_assignment_student ON public.assignment_answers(assignment_id, student_id);

ALTER TABLE public.assignment_answers ENABLE ROW LEVEL SECURITY;

-- Students manage their own answers (insert/update/delete/select)
CREATE POLICY "Students view own answers"
ON public.assignment_answers FOR SELECT TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students insert own answers"
ON public.assignment_answers FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_answers.assignment_id AND public.is_class_member(a.class_id, auth.uid())
  )
);

CREATE POLICY "Students update own answers"
ON public.assignment_answers FOR UPDATE TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Teachers view answers for their own assignments
CREATE POLICY "Teachers view answers for own assignments"
ON public.assignment_answers FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_answers.assignment_id AND a.teacher_id = auth.uid()
));

-- Teachers grade (update score/feedback) on their own assignments
CREATE POLICY "Teachers grade answers for own assignments"
ON public.assignment_answers FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_answers.assignment_id AND a.teacher_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_answers.assignment_id AND a.teacher_id = auth.uid()
));

-- Per-assignment overall grade row
CREATE TABLE public.assignment_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  overall_score int,
  overall_feedback text,
  graded_at timestamptz,
  graded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE public.assignment_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own grade"
ON public.assignment_grades FOR SELECT TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Teachers manage grades for own assignments"
ON public.assignment_grades FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_grades.assignment_id AND a.teacher_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_grades.assignment_id AND a.teacher_id = auth.uid()
));

-- Auto-grade MC answers and bump updated_at
CREATE OR REPLACE FUNCTION public.handle_assignment_answer_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _qtype public.question_type;
  _correct int;
  _max int;
BEGIN
  SELECT question_type, correct_index, max_score
    INTO _qtype, _correct, _max
  FROM public.assignment_questions WHERE id = NEW.question_id;

  IF _qtype = 'multiple_choice' AND NEW.selected_index IS NOT NULL AND _correct IS NOT NULL THEN
    NEW.is_correct := (NEW.selected_index = _correct);
    -- Auto-score MC if no teacher override has been set
    IF NEW.score IS NULL THEN
      NEW.score := CASE WHEN NEW.is_correct THEN _max ELSE 0 END;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignment_answer_save
BEFORE INSERT OR UPDATE ON public.assignment_answers
FOR EACH ROW EXECUTE FUNCTION public.handle_assignment_answer_save();

CREATE TRIGGER trg_assignment_grade_touch
BEFORE UPDATE ON public.assignment_grades
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();