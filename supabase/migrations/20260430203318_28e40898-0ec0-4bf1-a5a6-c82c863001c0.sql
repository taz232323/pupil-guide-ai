-- Ensure the classes table physically exists with the required structure.
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  join_code text NOT NULL DEFAULT public.generate_join_code(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS teacher_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS join_code text DEFAULT public.generate_join_code(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.classes
  ALTER COLUMN teacher_id SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN join_code SET NOT NULL,
  ALTER COLUMN join_code SET DEFAULT public.generate_join_code(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.classes'::regclass
      AND conname = 'classes_pkey'
  ) THEN
    ALTER TABLE public.classes ADD CONSTRAINT classes_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.classes'::regclass
      AND conname = 'classes_join_code_key'
  ) THEN
    ALTER TABLE public.classes ADD CONSTRAINT classes_join_code_key UNIQUE (join_code);
  END IF;
END $$;

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Restore function privileges required by class inserts and updates.
GRANT EXECUTE ON FUNCTION public.generate_join_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO authenticated;

DROP TRIGGER IF EXISTS trg_classes_updated ON public.classes;
CREATE TRIGGER trg_classes_updated
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Server-side teacher class creation keeps RLS/business checks in one stable place.
CREATE OR REPLACE FUNCTION public.create_teacher_class(_name text, _subject text)
RETURNS public.classes
LANGUAGE plpgsql
SECURITY INVOKER
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

-- App startup can call this lightweight action to request a schema-cache refresh.
CREATE OR REPLACE FUNCTION public.reload_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

REVOKE ALL ON FUNCTION public.reload_schema_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reload_schema_cache() TO anon, authenticated;

-- Ask the API layer to reload immediately after this migration.
NOTIFY pgrst, 'reload schema';