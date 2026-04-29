-- Assignment status enum
create type public.assignment_status as enum ('not_started', 'in_progress', 'submitted');

-- Assignments table
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null,
  title text not null,
  description text,
  unit_tag text,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assignments_class on public.assignments(class_id);

alter table public.assignments enable row level security;

create policy "Teachers manage their class assignments"
on public.assignments for all
to authenticated
using (auth.uid() = teacher_id and public.is_class_teacher(class_id, auth.uid()))
with check (auth.uid() = teacher_id and public.is_class_teacher(class_id, auth.uid()));

create policy "Students can view assignments in joined classes"
on public.assignments for select
to authenticated
using (public.is_class_member(class_id, auth.uid()));

create trigger assignments_updated_at
before update on public.assignments
for each row execute function public.touch_updated_at();

-- Per-student assignment status
create table public.assignment_status_records (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null,
  status public.assignment_status not null default 'not_started',
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index idx_asr_student on public.assignment_status_records(student_id);

alter table public.assignment_status_records enable row level security;

create policy "Students manage own status"
on public.assignment_status_records for all
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

create policy "Teachers can view status for their assignments"
on public.assignment_status_records for select
to authenticated
using (exists (
  select 1 from public.assignments a
  where a.id = assignment_id and a.teacher_id = auth.uid()
));

create trigger asr_updated_at
before update on public.assignment_status_records
for each row execute function public.touch_updated_at();