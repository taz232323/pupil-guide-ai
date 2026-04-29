-- Coins table
create table public.student_coins (
  student_id uuid primary key,
  star_coins integer not null default 0,
  crown_coins integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.student_coins enable row level security;

create policy "Students view own coins"
  on public.student_coins for select
  to authenticated
  using (auth.uid() = student_id);

create policy "Teachers view coins for class members"
  on public.student_coins for select
  to authenticated
  using (exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.student_id = student_coins.student_id
      and c.teacher_id = auth.uid()
  ));

-- Initialize coins row for any new student
create or replace function public.handle_new_student_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'student' then
    insert into public.student_coins (student_id) values (new.user_id)
    on conflict (student_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_user_role_created on public.user_roles;
create trigger on_user_role_created
after insert on public.user_roles
for each row execute function public.handle_new_student_coins();

-- Backfill for existing students
insert into public.student_coins (student_id)
select user_id from public.user_roles where role = 'student'
on conflict (student_id) do nothing;

-- Award coins on submission
create or replace function public.award_coins_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _due timestamptz;
  _class uuid;
  _unit text;
  _total int;
  _submitted int;
  _already_crowned boolean;
begin
  insert into public.student_coins (student_id) values (new.student_id)
  on conflict (student_id) do nothing;

  select due_date, class_id, unit_tag into _due, _class, _unit
  from public.assignments where id = new.assignment_id;

  -- Star coin: on-time submission (or no due date set)
  if _due is null or new.submitted_at <= _due then
    update public.student_coins
      set star_coins = star_coins + 1, updated_at = now()
      where student_id = new.student_id;
  end if;

  -- Crown coin: completed all assignments in this unit for the class
  if _unit is not null then
    select count(*) into _total
      from public.assignments
      where class_id = _class and unit_tag = _unit;

    select count(distinct s.assignment_id) into _submitted
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.student_id = new.student_id
        and a.class_id = _class
        and a.unit_tag = _unit;

    if _total > 0 and _submitted >= _total then
      -- only award once per unit completion event (idempotency via marker table)
      perform 1 from public.unit_crowns
        where student_id = new.student_id and class_id = _class and unit_tag = _unit;
      if not found then
        insert into public.unit_crowns (student_id, class_id, unit_tag)
          values (new.student_id, _class, _unit);
        update public.student_coins
          set crown_coins = crown_coins + 1, updated_at = now()
          where student_id = new.student_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Crown award tracking table for idempotency
create table public.unit_crowns (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null,
  unit_tag text not null,
  awarded_at timestamptz not null default now(),
  unique (student_id, class_id, unit_tag)
);

alter table public.unit_crowns enable row level security;

create policy "Students view own crown awards"
  on public.unit_crowns for select
  to authenticated
  using (auth.uid() = student_id);

drop trigger if exists on_submission_award_coins on public.submissions;
create trigger on_submission_award_coins
after insert on public.submissions
for each row execute function public.award_coins_on_submission();
