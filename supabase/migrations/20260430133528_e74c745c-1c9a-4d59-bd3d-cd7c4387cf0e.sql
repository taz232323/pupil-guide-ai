DROP POLICY IF EXISTS "Students create own purchases" ON public.shop_purchases;

CREATE POLICY "Students create own purchases"
ON public.shop_purchases
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND (
    class_id IS NULL
    OR public.is_class_member(class_id, auth.uid())
  )
);