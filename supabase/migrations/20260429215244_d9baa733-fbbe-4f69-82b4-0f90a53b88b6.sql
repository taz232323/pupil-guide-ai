-- Submissions table
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null,
  file_path text,
  link_url text,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id),
  check (file_path is not null or link_url is not null)
);

create index idx_submissions_assignment on public.submissions(assignment_id);
create index idx_submissions_student on public.submissions(student_id);

alter table public.submissions enable row level security;

create policy "Students manage own submissions"
on public.submissions for all
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

create policy "Teachers view submissions for their assignments"
on public.submissions for select
to authenticated
using (exists (
  select 1 from public.assignments a
  where a.id = assignment_id and a.teacher_id = auth.uid()
));

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;

create policy "Users manage own notifications"
on public.notifications for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Trigger: on submission, mark status submitted + notify teacher
create or replace function public.handle_new_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _teacher uuid;
  _title text;
  _student_name text;
begin
  select a.teacher_id, a.title into _teacher, _title
  from public.assignments a where a.id = new.assignment_id;

  -- update or insert status
  insert into public.assignment_status_records (assignment_id, student_id, status)
  values (new.assignment_id, new.student_id, 'submitted')
  on conflict (assignment_id, student_id)
  do update set status = 'submitted', updated_at = now();

  select coalesce(nullif(full_name, ''), 'A student') into _student_name
  from public.profiles where id = new.student_id;

  insert into public.notifications (user_id, type, message, link)
  values (
    _teacher,
    'submission',
    _student_name || ' submitted "' || _title || '"',
    '/teacher'
  );

  return new;
end;
$$;

create trigger submissions_after_insert
after insert on public.submissions
for each row execute function public.handle_new_submission();

-- Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- Storage policies: files keyed by <assignment_id>/<student_id>/<filename>
create policy "Students upload own submission files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Students view own submission files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Students delete own submission files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'submissions'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Teachers view submission files for their assignments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1 from public.assignments a
    where a.id::text = (storage.foldername(name))[1]
      and a.teacher_id = auth.uid()
  )
);