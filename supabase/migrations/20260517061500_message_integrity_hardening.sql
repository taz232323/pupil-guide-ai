-- Message integrity hardening: recipients may only mark messages as read, and
-- group membership must stay scoped to the group's class.

CREATE OR REPLACE FUNCTION public.enforce_message_recipient_read_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() = OLD.recipient_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.class_id IS DISTINCT FROM OLD.class_id
      OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
      OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
      OR NEW.body IS DISTINCT FROM OLD.body
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.group_id IS DISTINCT FROM OLD.group_id
      OR NEW.is_broadcast IS DISTINCT FROM OLD.is_broadcast
      OR NEW.broadcast_id IS DISTINCT FROM OLD.broadcast_id THEN
      RAISE EXCEPTION 'Recipients can only update message read_at';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_enforce_message_recipient_read_update ON public.messages;
CREATE TRIGGER a_enforce_message_recipient_read_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_recipient_read_update();

DROP POLICY IF EXISTS "Teachers manage their own groups" ON public.message_groups;
CREATE POLICY "Teachers manage their own groups"
ON public.message_groups FOR UPDATE TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (
  auth.uid() = teacher_id
  AND public.is_class_teacher(class_id, auth.uid())
);

DROP POLICY IF EXISTS "Teachers add members to their groups" ON public.message_group_members;
CREATE POLICY "Teachers add members to their groups"
ON public.message_group_members FOR INSERT TO authenticated
WITH CHECK (
  public.is_group_teacher(group_id, auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.message_groups g
    WHERE g.id = group_id
      AND (
        user_id = auth.uid()
        OR public.is_class_member(g.class_id, user_id)
      )
  )
);
