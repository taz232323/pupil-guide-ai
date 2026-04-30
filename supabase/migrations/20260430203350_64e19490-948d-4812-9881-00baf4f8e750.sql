CREATE OR REPLACE FUNCTION public.reload_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

REVOKE ALL ON FUNCTION public.reload_schema_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reload_schema_cache() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';