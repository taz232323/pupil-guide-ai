alter table public.messages
  add column if not exists sender_role text not null default 'student';

alter table public.messages
  drop constraint if exists messages_sender_role_check;

alter table public.messages
  add constraint messages_sender_role_check
  check (sender_role in ('student', 'teacher', 'parent'));

drop policy if exists "Parents send messages to class teachers" on public.messages;

create policy "Parents send messages to class teachers"
on public.messages for insert to authenticated
with check (
  sender_role = 'parent'
  and auth.uid() = sender_id
  and group_id is null
  and is_broadcast = false
  and broadcast_id is null
  and recipient_id is not null
  and public.is_class_member(class_id, auth.uid())
  and public.is_class_teacher(class_id, recipient_id)
);

select public.reload_schema_cache();
