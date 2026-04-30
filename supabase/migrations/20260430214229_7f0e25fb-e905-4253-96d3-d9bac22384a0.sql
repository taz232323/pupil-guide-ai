
-- 1) message_groups
create table public.message_groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  teacher_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.message_groups enable row level security;

create table public.message_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.message_groups(id) on delete cascade,
  user_id uuid not null,
  added_at timestamptz not null default now(),
  unique (group_id, user_id)
);
alter table public.message_group_members enable row level security;

create index idx_message_group_members_user on public.message_group_members(user_id);
create index idx_message_group_members_group on public.message_group_members(group_id);

-- helper: is user a member of a group
create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.message_group_members
    where group_id = _group_id and user_id = _user_id
  )
$$;

-- helper: is user the teacher (creator) of a group's class
create or replace function public.is_group_teacher(_group_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.message_groups g
    where g.id = _group_id and g.teacher_id = _user_id
  )
$$;

-- RLS for message_groups
create policy "Teachers create groups for their classes"
on public.message_groups for insert to authenticated
with check (
  auth.uid() = teacher_id
  and public.is_class_teacher(class_id, auth.uid())
);

create policy "Teachers manage their own groups"
on public.message_groups for update to authenticated
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

create policy "Teachers delete their own groups"
on public.message_groups for delete to authenticated
using (auth.uid() = teacher_id);

create policy "Members can view their groups"
on public.message_groups for select to authenticated
using (
  auth.uid() = teacher_id
  or public.is_group_member(id, auth.uid())
);

-- RLS for message_group_members
create policy "Teachers add members to their groups"
on public.message_group_members for insert to authenticated
with check (
  public.is_group_teacher(group_id, auth.uid())
);

create policy "Teachers remove members from their groups"
on public.message_group_members for delete to authenticated
using (public.is_group_teacher(group_id, auth.uid()));

create policy "Group members can view membership"
on public.message_group_members for select to authenticated
using (
  public.is_group_teacher(group_id, auth.uid())
  or public.is_group_member(group_id, auth.uid())
);

-- 2) extend messages
alter table public.messages
  add column if not exists group_id uuid references public.message_groups(id) on delete cascade,
  add column if not exists is_broadcast boolean not null default false,
  add column if not exists broadcast_id uuid;

alter table public.messages alter column recipient_id drop not null;

-- ensure either recipient_id or group_id set
alter table public.messages
  add constraint messages_target_check
  check (recipient_id is not null or group_id is not null);

create index if not exists idx_messages_group on public.messages(group_id);
create index if not exists idx_messages_broadcast on public.messages(broadcast_id);

-- New RLS policies for group + broadcast messages
create policy "Group members can view group messages"
on public.messages for select to authenticated
using (
  group_id is not null and public.is_group_member(group_id, auth.uid())
);

create policy "Group members can send group messages"
on public.messages for insert to authenticated
with check (
  group_id is not null
  and auth.uid() = sender_id
  and public.is_group_member(group_id, auth.uid())
);

-- Allow teachers to insert broadcast messages to students in classes they teach.
-- Each row is a normal DM (recipient_id is the student) but flagged as broadcast.
create policy "Teachers send broadcast messages"
on public.messages for insert to authenticated
with check (
  is_broadcast = true
  and auth.uid() = sender_id
  and group_id is null
  and recipient_id is not null
  and public.is_class_teacher(class_id, auth.uid())
  and public.is_class_member(class_id, recipient_id)
);

-- Reload PostgREST schema cache
select public.reload_schema_cache();
