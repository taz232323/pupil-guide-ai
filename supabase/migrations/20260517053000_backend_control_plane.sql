-- Backend control-plane hardening: invite-gated teachers, server-owned
-- critical mutations, audit trails, rate-limit state, and stronger constraints.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Teacher accounts must be created with a valid one-time invite code. Insert
-- invite rows with service-role/admin SQL:
--   INSERT INTO public.teacher_invites (code_hash, invited_email, expires_at)
--   VALUES (public.teacher_invite_hash('plain-code'), 'teacher@example.com', now() + interval '14 days');
CREATE TABLE IF NOT EXISTS public.teacher_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  invited_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.teacher_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.teacher_invite_hash(_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(convert_to(trim(_code), 'UTF8'), 'sha256'), 'hex')
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_invite_hash(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_invite_hash(text) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  _role public.app_role := 'student';
  _invite_code text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'teacher_invite_code', '')), '');
  _invite_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  IF _requested_role = 'teacher' AND _invite_code IS NOT NULL THEN
    SELECT id INTO _invite_id
    FROM public.teacher_invites
    WHERE code_hash = public.teacher_invite_hash(_invite_code)
      AND used_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
      AND (invited_email IS NULL OR lower(invited_email) = lower(new.email))
    FOR UPDATE;

    IF _invite_id IS NOT NULL THEN
      _role := 'teacher';
      UPDATE public.teacher_invites
      SET used_at = now(), used_by = new.id
      WHERE id = _invite_id;
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, _role);
  RETURN new;
END;
$$;

-- General append-only audit trail for privileged backend state changes.
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  subject_user_id uuid,
  action text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_actor ON public.security_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_subject ON public.security_audit_log(subject_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_entity ON public.security_audit_log(entity_table, entity_id);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view audit records involving themselves" ON public.security_audit_log;
CREATE POLICY "Users view audit records involving themselves"
  ON public.security_audit_log FOR SELECT
  TO authenticated
  USING (auth.uid() = actor_id OR auth.uid() = subject_user_id);

CREATE OR REPLACE FUNCTION public.write_security_audit(
  _action text,
  _entity_table text,
  _entity_id uuid DEFAULT NULL,
  _subject_user_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.security_audit_log (actor_id, subject_user_id, action, entity_table, entity_id, metadata)
  VALUES (auth.uid(), _subject_user_id, _action, _entity_table, _entity_id, coalesce(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.write_security_audit(text, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Function-backed Edge Function rate-limit state. Edge Functions call this
-- through the service-role client before external AI/provider work.
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_edge_rate_limit(
  _bucket_key text,
  _limit integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed boolean;
BEGIN
  IF _bucket_key IS NULL OR length(trim(_bucket_key)) = 0 THEN
    RAISE EXCEPTION 'Rate-limit bucket required';
  END IF;
  IF _limit < 1 OR _window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate-limit configuration';
  END IF;

  INSERT INTO public.edge_rate_limits (bucket_key, window_start, request_count, updated_at)
  VALUES (_bucket_key, now(), 1, now())
  ON CONFLICT (bucket_key) DO UPDATE SET
    window_start = CASE
      WHEN public.edge_rate_limits.window_start < now() - make_interval(secs => _window_seconds)
      THEN now()
      ELSE public.edge_rate_limits.window_start
    END,
    request_count = CASE
      WHEN public.edge_rate_limits.window_start < now() - make_interval(secs => _window_seconds)
      THEN 1
      ELSE public.edge_rate_limits.request_count + 1
    END,
    updated_at = now()
  RETURNING request_count <= _limit INTO _allowed;

  RETURN coalesce(_allowed, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_edge_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_edge_rate_limit(text, integer, integer) TO service_role;

-- Stronger table-level invariants.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_coins_nonnegative') THEN
    ALTER TABLE public.student_coins
      ADD CONSTRAINT student_coins_nonnegative
      CHECK (star_coins >= 0 AND crown_coins >= 0 AND streak_freezes >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_answers_score_nonnegative') THEN
    ALTER TABLE public.assignment_answers
      ADD CONSTRAINT assignment_answers_score_nonnegative
      CHECK (score IS NULL OR score >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_grades_score_nonnegative') THEN
    ALTER TABLE public.assignment_grades
      ADD CONSTRAINT assignment_grades_score_nonnegative
      CHECK (overall_score IS NULL OR overall_score >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_practice_session_status_check') THEN
    ALTER TABLE public.daily_practice_sessions
      ADD CONSTRAINT daily_practice_session_status_check
      CHECK (status IN ('in_progress', 'submitted')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_practice_question_type_check') THEN
    ALTER TABLE public.daily_practice_answers
      ADD CONSTRAINT daily_practice_question_type_check
      CHECK (question_type IN ('multiple_choice', 'short_answer')) NOT VALID;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_practice_answers_session_position
  ON public.daily_practice_answers(session_id, position);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_practice_answers_session_student_position
  ON public.daily_practice_answers(session_id, student_id, position);

-- Answer-only assignments are valid; the submission trigger below enforces
-- either file/link content or at least one non-empty answer row.
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_check;

CREATE OR REPLACE FUNCTION public.enforce_submission_has_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.file_path IS NULL
     AND NEW.link_url IS NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.assignment_answers aa
       WHERE aa.assignment_id = NEW.assignment_id
         AND aa.student_id = NEW.student_id
         AND (aa.selected_index IS NOT NULL OR nullif(trim(coalesce(aa.text_response, '')), '') IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'Submission requires a file, link, or answer content';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_enforce_submission_has_content ON public.submissions;
CREATE TRIGGER a_enforce_submission_has_content
  BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_has_content();

CREATE OR REPLACE FUNCTION public.enforce_assignment_status_student_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() = NEW.student_id THEN
    IF NEW.status = 'submitted' AND NOT EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.assignment_id = NEW.assignment_id AND s.student_id = NEW.student_id
    ) THEN
      RAISE EXCEPTION 'Submitted status requires a submission';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_enforce_assignment_status_student_update ON public.assignment_status_records;
CREATE TRIGGER a_enforce_assignment_status_student_update
  BEFORE INSERT OR UPDATE ON public.assignment_status_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_status_student_update();

-- Close older direct-write policies so assignment state changes go through
-- server-owned RPCs that can validate membership, status transitions, and audit.
DROP POLICY IF EXISTS "Students insert submissions for joined assignments" ON public.submissions;
DROP POLICY IF EXISTS "Students update submissions for joined assignments" ON public.submissions;
DROP POLICY IF EXISTS "Students delete own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students insert own answers before submission" ON public.assignment_answers;
DROP POLICY IF EXISTS "Students update own answers before submission" ON public.assignment_answers;
DROP POLICY IF EXISTS "Students insert status for joined-class assignments" ON public.assignment_status_records;
DROP POLICY IF EXISTS "Students update status for joined-class assignments" ON public.assignment_status_records;
DROP POLICY IF EXISTS "Students delete own status" ON public.assignment_status_records;

-- Critical mutation RPC: explicit student status changes. Final submission is
-- intentionally excluded here and must go through submit_assignment().
CREATE OR REPLACE FUNCTION public.set_assignment_status(
  _assignment_id uuid,
  _status public.assignment_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _class_id uuid;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status = 'submitted' THEN
    RAISE EXCEPTION 'Submitted status must be created through submit_assignment';
  END IF;

  SELECT class_id INTO _class_id FROM public.assignments WHERE id = _assignment_id;
  IF _class_id IS NULL THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  IF NOT public.is_class_member(_class_id, _user) THEN
    RAISE EXCEPTION 'Not enrolled in this assignment';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.submissions
    WHERE assignment_id = _assignment_id AND student_id = _user
  ) THEN
    RAISE EXCEPTION 'Submitted assignments cannot be changed';
  END IF;

  INSERT INTO public.assignment_status_records (assignment_id, student_id, status)
  VALUES (_assignment_id, _user, _status)
  ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = now();

  PERFORM public.write_security_audit(
    'assignment_status_set',
    'assignment_status_records',
    _assignment_id,
    _user,
    jsonb_build_object('status', _status)
  );

  RETURN jsonb_build_object('ok', true, 'status', _status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_assignment_status(uuid, public.assignment_status) TO authenticated;

-- Critical mutation RPC: save answer progress and mark the assignment in progress.
CREATE OR REPLACE FUNCTION public.save_assignment_progress(
  _assignment_id uuid,
  _answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _class_id uuid;
  _row jsonb;
  _question_id uuid;
  _selected_index int;
  _text_response text;
  _saved int := 0;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_typeof(coalesce(_answers, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'answers must be an array';
  END IF;
  IF jsonb_array_length(_answers) > 200 THEN
    RAISE EXCEPTION 'Too many answers';
  END IF;

  SELECT class_id INTO _class_id FROM public.assignments WHERE id = _assignment_id;
  IF _class_id IS NULL THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  IF NOT public.is_class_member(_class_id, _user) THEN
    RAISE EXCEPTION 'Not enrolled in this assignment';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.submissions
    WHERE assignment_id = _assignment_id AND student_id = _user
  ) THEN
    RAISE EXCEPTION 'Submitted assignments cannot be changed';
  END IF;

  FOR _row IN SELECT value FROM jsonb_array_elements(_answers)
  LOOP
    _question_id := (_row ->> 'question_id')::uuid;
    _selected_index := NULLIF(_row ->> 'selected_index', '')::int;
    _text_response := NULLIF(left(coalesce(_row ->> 'text_response', ''), 10000), '');

    IF NOT EXISTS (
      SELECT 1 FROM public.assignment_questions q
      WHERE q.id = _question_id AND q.assignment_id = _assignment_id
    ) THEN
      RAISE EXCEPTION 'Question does not belong to assignment';
    END IF;

    INSERT INTO public.assignment_answers (
      assignment_id, question_id, student_id, selected_index, text_response
    )
    VALUES (_assignment_id, _question_id, _user, _selected_index, _text_response)
    ON CONFLICT (question_id, student_id) DO UPDATE SET
      selected_index = EXCLUDED.selected_index,
      text_response = EXCLUDED.text_response;

    _saved := _saved + 1;
  END LOOP;

  INSERT INTO public.assignment_status_records (assignment_id, student_id, status)
  VALUES (_assignment_id, _user, 'in_progress')
  ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    status = CASE
      WHEN public.assignment_status_records.status = 'submitted' THEN 'submitted'::public.assignment_status
      ELSE 'in_progress'::public.assignment_status
    END,
    updated_at = now();

  PERFORM public.write_security_audit(
    'assignment_progress_saved',
    'assignments',
    _assignment_id,
    _user,
    jsonb_build_object('answers_saved', _saved)
  );

  RETURN jsonb_build_object('ok', true, 'answersSaved', _saved);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_assignment_progress(uuid, jsonb) TO authenticated;

-- Critical mutation RPC: final assignment submission.
CREATE OR REPLACE FUNCTION public.submit_assignment(
  _assignment_id uuid,
  _answers jsonb DEFAULT '[]'::jsonb,
  _file_path text DEFAULT NULL,
  _link_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _submission_id uuid;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM public.save_assignment_progress(_assignment_id, coalesce(_answers, '[]'::jsonb));

  IF _link_url IS NOT NULL AND _link_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Invalid link URL';
  END IF;
  IF _file_path IS NOT NULL AND position('/' || _user::text || '/' IN _file_path) = 0 THEN
    RAISE EXCEPTION 'Submission file path must include the student folder';
  END IF;

  INSERT INTO public.submissions (assignment_id, student_id, file_path, link_url)
  VALUES (_assignment_id, _user, nullif(_file_path, ''), nullif(_link_url, ''))
  ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    file_path = coalesce(EXCLUDED.file_path, public.submissions.file_path),
    link_url = coalesce(EXCLUDED.link_url, public.submissions.link_url)
  RETURNING id INTO _submission_id;

  INSERT INTO public.assignment_status_records (assignment_id, student_id, status)
  VALUES (_assignment_id, _user, 'submitted')
  ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    status = 'submitted',
    updated_at = now();

  PERFORM public.write_security_audit(
    'assignment_submitted',
    'submissions',
    _submission_id,
    _user,
    jsonb_build_object('assignment_id', _assignment_id)
  );

  RETURN jsonb_build_object('ok', true, 'submissionId', _submission_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_assignment(uuid, jsonb, text, text) TO authenticated;

-- Critical mutation RPC: teacher-owned grade save, including notification.
CREATE OR REPLACE FUNCTION public.grade_assignment_submission(
  _assignment_id uuid,
  _student_id uuid,
  _answer_grades jsonb DEFAULT '[]'::jsonb,
  _overall_score integer DEFAULT NULL,
  _overall_feedback text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _teacher uuid := auth.uid();
  _assignment_title text;
  _row jsonb;
  _answer_id uuid;
  _score int;
  _feedback text;
  _updated_answers int := 0;
  _grade_id uuid;
BEGIN
  IF _teacher IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT title INTO _assignment_title
  FROM public.assignments
  WHERE id = _assignment_id AND teacher_id = _teacher;
  IF _assignment_title IS NULL THEN
    RAISE EXCEPTION 'Assignment not found for this teacher';
  END IF;

  IF jsonb_typeof(coalesce(_answer_grades, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'answer_grades must be an array';
  END IF;

  FOR _row IN SELECT value FROM jsonb_array_elements(_answer_grades)
  LOOP
    _answer_id := (_row ->> 'answer_id')::uuid;
    _score := NULLIF(_row ->> 'score', '')::int;
    _feedback := NULLIF(left(coalesce(_row ->> 'feedback', ''), 5000), '');

    IF _score IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.assignment_answers aa
      JOIN public.assignment_questions q ON q.id = aa.question_id
      WHERE aa.id = _answer_id
        AND q.max_score < _score
    ) THEN
      RAISE EXCEPTION 'Score exceeds question maximum';
    END IF;

    UPDATE public.assignment_answers aa
    SET score = _score,
        feedback = _feedback,
        graded_at = now(),
        graded_by = _teacher
    WHERE aa.id = _answer_id
      AND aa.assignment_id = _assignment_id
      AND aa.student_id = _student_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Answer not found for this assignment and student';
    END IF;
    _updated_answers := _updated_answers + 1;
  END LOOP;

  INSERT INTO public.assignment_grades (
    assignment_id, student_id, overall_score, overall_feedback, graded_at, graded_by
  )
  VALUES (
    _assignment_id, _student_id, _overall_score, nullif(_overall_feedback, ''), now(), _teacher
  )
  ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    overall_feedback = EXCLUDED.overall_feedback,
    graded_at = now(),
    graded_by = _teacher,
    updated_at = now()
  RETURNING id INTO _grade_id;

  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (
    _student_id,
    'assignment_graded',
    'Your assignment "' || _assignment_title || '" has been graded — check your feedback.',
    '/student/assignments/' || _assignment_id::text
  );

  PERFORM public.write_security_audit(
    'assignment_graded',
    'assignment_grades',
    _grade_id,
    _student_id,
    jsonb_build_object('assignment_id', _assignment_id, 'answers_updated', _updated_answers)
  );

  RETURN jsonb_build_object('ok', true, 'gradeId', _grade_id, 'answersUpdated', _updated_answers);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_assignment_submission(uuid, uuid, jsonb, integer, text) TO authenticated;

-- Critical mutation RPC: canonical shop purchase creation.
DROP POLICY IF EXISTS "Students create own purchases" ON public.shop_purchases;

CREATE OR REPLACE FUNCTION public.create_shop_purchase(
  _class_id uuid,
  _item_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _item public.shop_items%ROWTYPE;
  _purchase public.shop_purchases%ROWTYPE;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(_user, 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Only students can purchase shop items';
  END IF;

  SELECT * INTO _item FROM public.shop_items WHERE item_key = _item_key AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shop item not found'; END IF;

  IF _item.kind = 'privilege' THEN
    IF _class_id IS NULL THEN RAISE EXCEPTION 'Class required for privilege purchases'; END IF;
    IF NOT public.is_class_member(_class_id, _user) THEN
      RAISE EXCEPTION 'Not enrolled in this class';
    END IF;
  ELSE
    _class_id := NULL;
  END IF;

  INSERT INTO public.shop_purchases (
    student_id, class_id, item_key, item_name, kind, currency, cost
  )
  VALUES (
    _user, _class_id, _item.item_key, _item.item_name, _item.kind, _item.currency, _item.cost
  )
  RETURNING * INTO _purchase;

  PERFORM public.write_security_audit(
    'shop_purchase_created',
    'shop_purchases',
    _purchase.id,
    _user,
    jsonb_build_object('item_key', _item.item_key, 'status', _purchase.status)
  );

  RETURN jsonb_build_object('ok', true, 'purchaseId', _purchase.id, 'status', _purchase.status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_shop_purchase(uuid, text) TO authenticated;

-- Critical mutation RPC: teacher-owned privilege resolution.
DROP POLICY IF EXISTS "Teachers resolve purchases for their classes" ON public.shop_purchases;

CREATE OR REPLACE FUNCTION public.resolve_shop_purchase(
  _purchase_id uuid,
  _status public.purchase_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _teacher uuid := auth.uid();
  _purchase public.shop_purchases%ROWTYPE;
BEGIN
  IF _teacher IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status NOT IN ('approved', 'denied') THEN
    RAISE EXCEPTION 'Invalid resolution status';
  END IF;

  SELECT * INTO _purchase
  FROM public.shop_purchases
  WHERE id = _purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF _purchase.kind <> 'privilege' OR _purchase.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending privilege purchases can be resolved';
  END IF;
  IF _purchase.class_id IS NULL OR NOT public.is_class_teacher(_purchase.class_id, _teacher) THEN
    RAISE EXCEPTION 'Not allowed to resolve this purchase';
  END IF;

  UPDATE public.shop_purchases
  SET status = _status
  WHERE id = _purchase_id;

  PERFORM public.write_security_audit(
    'shop_purchase_' || _status::text,
    'shop_purchases',
    _purchase_id,
    _purchase.student_id,
    jsonb_build_object('item_key', _purchase.item_key)
  );

  RETURN jsonb_build_object('ok', true, 'status', _status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_shop_purchase(uuid, public.purchase_status) TO authenticated;

-- Force grading through the RPC while preserving teacher read access.
DROP POLICY IF EXISTS "Teachers grade answers for own assignments" ON public.assignment_answers;
DROP POLICY IF EXISTS "Teachers manage grades for own assignments" ON public.assignment_grades;

CREATE POLICY "Teachers view grades for own assignments"
ON public.assignment_grades FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_grades.assignment_id AND a.teacher_id = auth.uid()
));

-- Audit triggers for durable backend changes.
CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_security_audit(
      'user_role_insert',
      'user_roles',
      NEW.id,
      NEW.user_id,
      jsonb_build_object('new_role', NEW.role)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.write_security_audit(
      'user_role_update',
      'user_roles',
      NEW.id,
      NEW.user_id,
      jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role)
    );
  ELSE
    PERFORM public.write_security_audit(
      'user_role_delete',
      'user_roles',
      OLD.id,
      OLD.user_id,
      jsonb_build_object('old_role', OLD.role)
    );
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_user_role_changes ON public.user_roles;
CREATE TRIGGER audit_user_role_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();

CREATE OR REPLACE FUNCTION public.audit_student_coin_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.star_coins IS DISTINCT FROM OLD.star_coins
     OR NEW.crown_coins IS DISTINCT FROM OLD.crown_coins
     OR NEW.streak_freezes IS DISTINCT FROM OLD.streak_freezes THEN
    PERFORM public.write_security_audit(
      'student_coins_updated',
      'student_coins',
      NULL,
      NEW.student_id,
      jsonb_build_object(
        'star_delta', NEW.star_coins - OLD.star_coins,
        'crown_delta', NEW.crown_coins - OLD.crown_coins,
        'freeze_delta', NEW.streak_freezes - OLD.streak_freezes
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_student_coin_changes ON public.student_coins;
CREATE TRIGGER audit_student_coin_changes
  AFTER UPDATE ON public.student_coins
  FOR EACH ROW EXECUTE FUNCTION public.audit_student_coin_changes();
