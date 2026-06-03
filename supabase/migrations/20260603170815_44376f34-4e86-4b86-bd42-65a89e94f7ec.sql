
-- 1. Tighten profiles SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users view own and class-related profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.class_members cm_self
    JOIN public.class_members cm_other ON cm_other.class_id = cm_self.class_id
    WHERE cm_self.student_id = auth.uid() AND cm_other.student_id = profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.class_members cm ON cm.class_id = c.id
    WHERE c.teacher_id = auth.uid() AND cm.student_id = profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.class_members cm ON cm.class_id = c.id
    WHERE cm.student_id = auth.uid() AND c.teacher_id = profiles.id
  )
);

-- 2. Explicit deny policies for user_roles client mutations
CREATE POLICY "No client inserts on user_roles"
ON public.user_roles FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "No client updates on user_roles"
ON public.user_roles FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "No client deletes on user_roles"
ON public.user_roles FOR DELETE TO authenticated USING (false);

-- 3. Revoke EXECUTE from PUBLIC/anon on functions not meant to be callable
REVOKE EXECUTE ON FUNCTION public.enforce_cosmetic_ownership() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_assignment_answer_save() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.teacher_award_coins(uuid, uuid[], text, integer, text) FROM PUBLIC, anon;
