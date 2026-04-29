-- Join code generator (6 chars, uppercase letters + digits, no ambiguous 0/O/1/I)
create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- Classes
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text not null,
  join_code text not null unique default public.generate_join_code(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_classes_teacher on public.classes(teacher_id);

alter table public.classes enable row level security;

-- Class members
create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create index idx_class_members_student on public.class_members(student_id);
create index idx_class_members_class on public.class_members(class_id);

alter table public.class_members enable row level security;

-- Helper: is the current user a member of the given class? (avoids recursion)
create or replace function public.is_class_member(_class_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.class_members
    where class_id = _class_id and student_id = _user_id
  )
$$;

revoke execute on function public.is_class_member(uuid, uuid) from anon;

-- Helper: is the current user the teacher of the given class?
create or replace function public.is_class_teacher(_class_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.classes
    where id = _class_id and teacher_id = _user_id
  )
$$;

revoke execute on function public.is_class_teacher(uuid, uuid) from anon;

-- Policies: classes
create policy "Teachers can view their own classes"
  on public.classes for select
  to authenticated
  using (auth.uid() = teacher_id);

create policy "Students can view classes they belong to"
  on public.classes for select
  to authenticated
  using (public.is_class_member(id, auth.uid()));

create policy "Teachers can create classes"
  on public.classes for insert
  to authenticated
  with check (auth.uid() = teacher_id and public.has_role(auth.uid(), 'teacher'));

create policy "Teachers can update their own classes"
  on public.classes for update
  to authenticated
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own classes"
  on public.classes for delete
  to authenticated
  using (auth.uid() = teacher_id);

-- Policies: class_members
create policy "Students can view their own memberships"
  on public.class_members for select
  to authenticated
  using (auth.uid() = student_id);

create policy "Teachers can view members of their classes"
  on public.class_members for select
  to authenticated
  using (public.is_class_teacher(class_id, auth.uid()));

create policy "Students can join classes for themselves"
  on public.class_members for insert
  to authenticated
  with check (auth.uid() = student_id and public.has_role(auth.uid(), 'student'));

create policy "Students can leave their own memberships"
  on public.class_members for delete
  to authenticated
  using (auth.uid() = student_id);

create policy "Teachers can remove members from their classes"
  on public.class_members for delete
  to authenticated
  using (public.is_class_teacher(class_id, auth.uid()));

-- Updated_at trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_classes_updated
  before update on public.classes
  for each row execute function public.touch_updated_at();

-- RPC: join a class by code (returns the class id, or raises)
create or replace function public.join_class_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  insert into public.class_members (class_id, student_id)
  values (_class_id, _user)
  on conflict (class_id, student_id) do nothing;

  return _class_id;
end;
$$;

revoke execute on function public.join_class_by_code(text) from anon;
grant execute on function public.join_class_by_code(text) to authenticated;