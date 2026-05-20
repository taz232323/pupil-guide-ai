-- Security hardening for classroom privacy and student-write integrity.

-- Profiles should not be globally visible to every authenticated account.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Teachers view profiles for their class students"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE cm.student_id = profiles.id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students view classmates in shared classes"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members me
      JOIN public.class_members them ON them.class_id = me.class_id
      WHERE me.student_id = auth.uid()
        AND them.student_id = profiles.id
    )
  );

CREATE POLICY "Students view teachers for joined classes"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE cm.student_id = auth.uid()
        AND c.teacher_id = profiles.id
    )
  );

-- Submission rows must stay tied to assignments the student can currently access.
DROP POLICY IF EXISTS "Students manage own submissions" ON public.submissions;

CREATE POLICY "Students view own submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students insert submissions for joined assignments"
  ON public.submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND public.is_class_member(a.class_id, auth.uid())
    )
  );

CREATE POLICY "Students update submissions for joined assignments"
  ON public.submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND public.is_class_member(a.class_id, auth.uid())
    )
  );

CREATE POLICY "Students delete own submissions"
  ON public.submissions FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);

CREATE OR REPLACE FUNCTION public.enforce_submission_student_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND auth.role() = 'authenticated' AND auth.uid() = OLD.student_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
      OR NEW.student_id IS DISTINCT FROM OLD.student_id
      OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'Students can only update submission content';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_enforce_submission_student_update ON public.submissions;
CREATE TRIGGER a_enforce_submission_student_update
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_student_update();

-- Assignment answers must belong to the assignment they claim, and students may
-- not write grading fields or move answers between assignments/questions.
DROP POLICY IF EXISTS "Students insert own answers" ON public.assignment_answers;
DROP POLICY IF EXISTS "Students update own answers" ON public.assignment_answers;

CREATE POLICY "Students insert own answers before submission"
  ON public.assignment_answers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = assignment_answers.assignment_id
        AND public.is_class_member(a.class_id, auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.submissions s
      WHERE s.assignment_id = assignment_answers.assignment_id
        AND s.student_id = auth.uid()
    )
  );

CREATE POLICY "Students update own answers before submission"
  ON public.assignment_answers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = student_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.submissions s
      WHERE s.assignment_id = assignment_answers.assignment_id
        AND s.student_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = assignment_answers.assignment_id
        AND public.is_class_member(a.class_id, auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.submissions s
      WHERE s.assignment_id = assignment_answers.assignment_id
        AND s.student_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_assignment_answer_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.assignment_questions q
    WHERE q.id = NEW.question_id
      AND q.assignment_id = NEW.assignment_id
  ) THEN
    RAISE EXCEPTION 'Question does not belong to assignment';
  END IF;

  IF auth.role() = 'authenticated' AND auth.uid() = NEW.student_id THEN
    IF TG_OP = 'INSERT' THEN
      NEW.score := NULL;
      NEW.feedback := NULL;
      NEW.graded_at := NULL;
      NEW.graded_by := NULL;
      NEW.is_correct := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.question_id IS DISTINCT FROM OLD.question_id
        OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
        OR NEW.student_id IS DISTINCT FROM OLD.student_id
        OR NEW.score IS DISTINCT FROM OLD.score
        OR NEW.feedback IS DISTINCT FROM OLD.feedback
        OR NEW.graded_at IS DISTINCT FROM OLD.graded_at
        OR NEW.graded_by IS DISTINCT FROM OLD.graded_by
        OR NEW.is_correct IS DISTINCT FROM OLD.is_correct THEN
        RAISE EXCEPTION 'Students can only update their answer response';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_enforce_assignment_answer_integrity ON public.assignment_answers;
CREATE TRIGGER a_enforce_assignment_answer_integrity
  BEFORE INSERT OR UPDATE ON public.assignment_answers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_answer_integrity();

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
  FROM public.assignment_questions
  WHERE id = NEW.question_id;

  IF _qtype = 'multiple_choice' AND NEW.selected_index IS NOT NULL AND _correct IS NOT NULL THEN
    NEW.is_correct := (NEW.selected_index = _correct);
    IF NEW.graded_at IS NULL AND NEW.graded_by IS NULL THEN
      NEW.score := CASE WHEN NEW.is_correct THEN _max ELSE 0 END;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Daily practice session/answer creation is server-owned. Students may read
-- their own rows and update only selected_index/text_response before submit.
DROP POLICY IF EXISTS "Students manage own practice sessions" ON public.daily_practice_sessions;

CREATE POLICY "Students view own practice sessions"
  ON public.daily_practice_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students manage own practice answers" ON public.daily_practice_answers;

CREATE POLICY "Students view own practice answers"
  ON public.daily_practice_answers FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students update own in-progress practice answers"
  ON public.daily_practice_answers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.daily_practice_sessions s
      WHERE s.id = daily_practice_answers.session_id
        AND s.student_id = auth.uid()
        AND s.status = 'in_progress'
    )
  )
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.daily_practice_sessions s
      WHERE s.id = daily_practice_answers.session_id
        AND s.student_id = auth.uid()
        AND s.status = 'in_progress'
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_daily_practice_answer_student_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.daily_practice_sessions s
    WHERE s.id = NEW.session_id
      AND s.student_id = NEW.student_id
  ) THEN
    RAISE EXCEPTION 'Practice answer does not belong to the student session';
  END IF;

  IF auth.role() = 'authenticated' AND auth.uid() = NEW.student_id THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Practice questions are generated by the server';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.session_id IS DISTINCT FROM OLD.session_id
      OR NEW.student_id IS DISTINCT FROM OLD.student_id
      OR NEW.position IS DISTINCT FROM OLD.position
      OR NEW.question_type IS DISTINCT FROM OLD.question_type
      OR NEW.prompt IS DISTINCT FROM OLD.prompt
      OR NEW.options IS DISTINCT FROM OLD.options
      OR NEW.correct_index IS DISTINCT FROM OLD.correct_index
      OR NEW.expected_answer IS DISTINCT FROM OLD.expected_answer
      OR NEW.is_correct IS DISTINCT FROM OLD.is_correct
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Students can only update practice responses';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_enforce_daily_practice_answer_student_update ON public.daily_practice_answers;
CREATE TRIGGER a_enforce_daily_practice_answer_student_update
  BEFORE INSERT OR UPDATE ON public.daily_practice_answers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_practice_answer_student_update();
