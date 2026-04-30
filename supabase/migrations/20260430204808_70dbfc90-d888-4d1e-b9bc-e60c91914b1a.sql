CREATE POLICY "Students can view classmates in shared classes"
ON public.class_members
FOR SELECT
TO authenticated
USING (public.is_class_member(class_id, auth.uid()));