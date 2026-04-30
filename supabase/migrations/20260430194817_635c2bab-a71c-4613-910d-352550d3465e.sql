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

NOTIFY pgrst, 'reload schema';