-- Ensure the classes table has the required domain fields.
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS join_code text DEFAULT public.generate_join_code(),
  ADD COLUMN IF NOT EXISTS teacher_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Keep required class fields non-empty for new data.
ALTER TABLE public.classes
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN join_code SET NOT NULL,
  ALTER COLUMN teacher_id SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

-- Ensure join codes stay unique.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.classes'::regclass
      AND conname = 'classes_join_code_key'
  ) THEN
    ALTER TABLE public.classes ADD CONSTRAINT classes_join_code_key UNIQUE (join_code);
  END IF;
END $$;

-- Restore automatic updated_at maintenance for classes.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classes_updated ON public.classes;
CREATE TRIGGER trg_classes_updated
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Create a stable server-side class creation action to avoid client/schema-cache ambiguity.
CREATE OR REPLACE FUNCTION public.create_teacher_class(_name text, _subject text)
RETURNS public.classes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _class public.classes;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF NOT public.has_role(_user, 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Only teachers can create classes';
  END IF;

  IF NULLIF(BTRIM(_name), '') IS NULL THEN
    RAISE EXCEPTION 'Class name is required';
  END IF;

  IF NULLIF(BTRIM(_subject), '') IS NULL THEN
    RAISE EXCEPTION 'Subject is required';
  END IF;

  INSERT INTO public.classes (teacher_id, name, subject)
  VALUES (_user, BTRIM(_name), BTRIM(_subject))
  RETURNING * INTO _class;

  RETURN _class;
END;
$$;

REVOKE ALL ON FUNCTION public.create_teacher_class(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_teacher_class(text, text) TO authenticated;

-- Refresh the API schema cache.
NOTIFY pgrst, 'reload schema';