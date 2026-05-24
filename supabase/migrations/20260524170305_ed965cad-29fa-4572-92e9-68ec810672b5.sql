
-- 1) Cosmetics: add owner + scope writes
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS created_by uuid;

DROP POLICY IF EXISTS "Teachers can insert cosmetics" ON public.cosmetics;
DROP POLICY IF EXISTS "Teachers can update cosmetics" ON public.cosmetics;
DROP POLICY IF EXISTS "Teachers can delete cosmetics" ON public.cosmetics;

CREATE POLICY "Teachers insert own cosmetics"
ON public.cosmetics FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

CREATE POLICY "Teachers update own cosmetics"
ON public.cosmetics FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

CREATE POLICY "Teachers delete own cosmetics"
ON public.cosmetics FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

-- 2) Shop items: add owner + scope writes
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS created_by uuid;

DROP POLICY IF EXISTS "Teachers can insert shop items" ON public.shop_items;
DROP POLICY IF EXISTS "Teachers can update shop items" ON public.shop_items;
DROP POLICY IF EXISTS "Teachers can delete shop items" ON public.shop_items;

CREATE POLICY "Teachers insert own shop items"
ON public.shop_items FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

CREATE POLICY "Teachers update own shop items"
ON public.shop_items FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

CREATE POLICY "Teachers delete own shop items"
ON public.shop_items FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

-- 3) Restrict realtime.messages SELECT to user-scoped topics
DROP POLICY IF EXISTS "Authenticated users can connect to realtime" ON realtime.messages;

CREATE POLICY "Users can only subscribe to their own user topic"
ON realtime.messages FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'student'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  AND realtime.topic() = ('user:' || auth.uid()::text)
);

-- 4) Revoke EXECUTE on SECURITY DEFINER helper functions from anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_group_teacher(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_message(uuid, uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_message(uuid, uuid, uuid) TO authenticated;

-- 5) Remove broad listing policy on public module-files bucket.
-- Files remain accessible via their direct public URL but are no longer enumerable.
DROP POLICY IF EXISTS "Module files are publicly readable" ON storage.objects;
