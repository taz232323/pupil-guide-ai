create table public.messages (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  sender_id uuid not null,
  recipient_id uuid not null,
  body text not null check (length(body) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_pair on public.messages(class_id, sender_id, recipient_id, created_at);
create index idx_messages_recipient on public.messages(recipient_id, created_at desc);

alter table public.messages enable row level security;

-- Helper: is the user the teacher of this class?
-- (already have public.is_class_teacher)

-- Helper: is the user a student in this class?
-- (already have public.is_class_member)

-- Validate that a (sender, recipient, class) trio is allowed
create or replace function public.can_message(_class_id uuid, _sender uuid, _recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _sender <> _recipient
    and (
      -- student -> teacher of the class
      (public.is_class_member(_class_id, _sender) and public.is_class_teacher(_class_id, _recipient))
      -- teacher -> student in the class
      or (public.is_class_teacher(_class_id, _sender) and public.is_class_member(_class_id, _recipient))
      -- student <-> student in the same class
      or (public.is_class_member(_class_id, _sender) and public.is_class_member(_class_id, _recipient))
    )
$$;

create policy "Send messages within allowed pairings"
on public.messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and public.can_message(class_id, sender_id, recipient_id)
);

create policy "Sender or recipient can view"
on public.messages for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Class teacher can view all messages in their class"
on public.messages for select
to authenticated
using (public.is_class_teacher(class_id, auth.uid()));

create policy "Recipient can mark read"
on public.messages for update
to authenticated
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

-- Realtime
alter publication supabase_realtime add table public.messages;