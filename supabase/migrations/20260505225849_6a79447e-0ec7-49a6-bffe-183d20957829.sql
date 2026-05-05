CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _class_id uuid;
  _user uuid := auth.uid();
begin
  if _user is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_role(_user, 'student') then
    raise exception 'Only students can join classes';
  end if;

  select id into _class_id from public.classes where upper(join_code) = upper(_code);
  if _class_id is null then
    raise exception 'Invalid join code';
  end if;

  if exists (select 1 from public.class_members where class_id = _class_id and student_id = _user) then
    raise exception 'You are already enrolled in this class';
  end if;

  insert into public.class_members (class_id, student_id)
  values (_class_id, _user);

  return _class_id;
end;
$function$;