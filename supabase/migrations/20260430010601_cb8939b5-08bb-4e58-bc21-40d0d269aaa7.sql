
-- 1) Lock down SECURITY DEFINER function execution: revoke from anon/public
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.get_current_user_role() from public, anon;
revoke execute on function public.is_class_teacher(uuid, uuid) from public, anon;
revoke execute on function public.is_class_member(uuid, uuid) from public, anon;
revoke execute on function public.can_message(uuid, uuid, uuid) from public, anon;
revoke execute on function public.join_class_by_code(text) from public, anon;
revoke execute on function public.generate_join_code() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.handle_new_student_coins() from public, anon;
revoke execute on function public.handle_new_submission() from public, anon;
revoke execute on function public.handle_shop_purchase() from public, anon;
revoke execute on function public.handle_shop_purchase_resolution() from public, anon;
revoke execute on function public.award_coins_on_submission() from public, anon;
revoke execute on function public.touch_updated_at() from public, anon;

-- Trigger functions: revoke from authenticated as well (triggers run as definer regardless)
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_student_coins() from authenticated;
revoke execute on function public.handle_new_submission() from authenticated;
revoke execute on function public.handle_shop_purchase() from authenticated;
revoke execute on function public.handle_shop_purchase_resolution() from authenticated;
revoke execute on function public.award_coins_on_submission() from authenticated;
revoke execute on function public.touch_updated_at() from authenticated;
revoke execute on function public.generate_join_code() from authenticated;

-- Keep these callable by signed-in users (used by RLS / app)
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.get_current_user_role() to authenticated;
grant execute on function public.is_class_teacher(uuid, uuid) to authenticated;
grant execute on function public.is_class_member(uuid, uuid) to authenticated;
grant execute on function public.can_message(uuid, uuid, uuid) to authenticated;
grant execute on function public.join_class_by_code(text) to authenticated;

-- 2) unit_crowns: prevent direct writes by users; let teachers view for their classes
create policy "Teachers view crowns for their class students"
on public.unit_crowns
for select
to authenticated
using (public.is_class_teacher(class_id, auth.uid()));

create policy "No direct inserts to unit_crowns"
on public.unit_crowns
for insert
to authenticated
with check (false);

create policy "No direct updates to unit_crowns"
on public.unit_crowns
for update
to authenticated
using (false)
with check (false);

create policy "No direct deletes from unit_crowns"
on public.unit_crowns
for delete
to authenticated
using (false);

-- 3) Realtime channel authorization for messages
-- Topic format used in app: "messages-<conversation_key>" (see Messages.tsx).
-- Restrict subscriptions to users who are the class teacher OR a member of the class
-- referenced by an existing message they would be able to read under messages RLS.
-- Since topic strings vary, we authorize any authenticated user to subscribe only if
-- they are a teacher or student of at least one class. Per-message delivery is still
-- gated by the public.messages RLS (sender/recipient/teacher), so users will only
-- receive payloads they can read.

alter table realtime.messages enable row level security;

create policy "Authenticated users can connect to realtime"
on realtime.messages
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student'::public.app_role)
  or public.has_role(auth.uid(), 'teacher'::public.app_role)
);
