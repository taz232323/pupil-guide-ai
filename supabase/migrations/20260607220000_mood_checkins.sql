create table public.mood_checkins (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null default 'How are you feeling today?',
  mood_key text null,
  note text null,
  wants_help boolean not null default false,
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint mood_checkins_mood_key_check check (
    mood_key is null
    or mood_key in ('happy', 'excited', 'neutral', 'tired', 'sad', 'anxious', 'frustrated', 'angry')
  ),
  constraint mood_checkins_prompt_length check (char_length(prompt) between 1 and 240),
  constraint mood_checkins_note_length check (note is null or char_length(note) <= 500)
);

create index idx_mood_checkins_student_pending
  on public.mood_checkins(student_id, responded_at, created_at desc);

create index idx_mood_checkins_class_recent
  on public.mood_checkins(class_id, created_at desc);

create index idx_mood_checkins_teacher_recent
  on public.mood_checkins(teacher_id, created_at desc);

alter table public.mood_checkins enable row level security;

create policy "Students view their own mood checkins"
  on public.mood_checkins for select
  to authenticated
  using (auth.uid() = student_id);

create policy "Teachers view mood checkins for their classes"
  on public.mood_checkins for select
  to authenticated
  using (public.is_class_teacher(class_id, auth.uid()));

create trigger trg_mood_checkins_updated
  before update on public.mood_checkins
  for each row execute function public.touch_updated_at();

create or replace function public.teacher_send_mood_checkins(
  _class_id uuid,
  _student_ids uuid[],
  _prompt text default 'How are you feeling today?'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _teacher uuid := auth.uid();
  _teacher_name text;
  _sid uuid;
  _seen uuid[] := array[]::uuid[];
  _prompt_clean text := nullif(btrim(coalesce(_prompt, '')), '');
  _count integer := 0;
begin
  if _teacher is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_class_teacher(_class_id, _teacher) then
    raise exception 'Only the class teacher can send check-ins';
  end if;

  if coalesce(array_length(_student_ids, 1), 0) = 0 then
    raise exception 'Select at least one student';
  end if;

  _prompt_clean := coalesce(_prompt_clean, 'How are you feeling today?');

  if char_length(_prompt_clean) > 240 then
    raise exception 'Prompt must be 240 characters or fewer';
  end if;

  select coalesce(nullif(full_name, ''), 'Your teacher')
    into _teacher_name
    from public.profiles
    where id = _teacher;

  foreach _sid in array _student_ids loop
    if _sid is null or _sid = any(_seen) then
      continue;
    end if;
    _seen := array_append(_seen, _sid);

    if not public.is_class_member(_class_id, _sid) then
      continue;
    end if;

    insert into public.mood_checkins (class_id, teacher_id, student_id, prompt)
    values (_class_id, _teacher, _sid, _prompt_clean);

    insert into public.notifications (user_id, type, message, link)
    values (
      _sid,
      'mood_checkin',
      coalesce(_teacher_name, 'Your teacher') || ' sent you a quick check-in.',
      '/student'
    );

    _count := _count + 1;
  end loop;

  return _count;
end;
$$;

create or replace function public.student_respond_mood_checkin(
  _checkin_id uuid,
  _mood_key text,
  _note text default null,
  _wants_help boolean default false
)
returns public.mood_checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  _student uuid := auth.uid();
  _mood_clean text := lower(btrim(coalesce(_mood_key, '')));
  _note_clean text := nullif(btrim(coalesce(_note, '')), '');
  _row public.mood_checkins;
begin
  if _student is null then
    raise exception 'Not authenticated';
  end if;

  if _mood_clean not in ('happy', 'excited', 'neutral', 'tired', 'sad', 'anxious', 'frustrated', 'angry') then
    raise exception 'Choose a valid feeling';
  end if;

  if _note_clean is not null and char_length(_note_clean) > 500 then
    raise exception 'Note must be 500 characters or fewer';
  end if;

  update public.mood_checkins
    set mood_key = _mood_clean,
        note = _note_clean,
        wants_help = coalesce(_wants_help, false),
        responded_at = now()
    where id = _checkin_id
      and student_id = _student
    returning * into _row;

  if _row.id is null then
    raise exception 'Check-in not found';
  end if;

  return _row;
end;
$$;

revoke execute on function public.teacher_send_mood_checkins(uuid, uuid[], text) from public, anon;
grant execute on function public.teacher_send_mood_checkins(uuid, uuid[], text) to authenticated;

revoke execute on function public.student_respond_mood_checkin(uuid, text, text, boolean) from public, anon;
grant execute on function public.student_respond_mood_checkin(uuid, text, text, boolean) to authenticated;

select public.reload_schema_cache();
notify pgrst, 'reload schema';
