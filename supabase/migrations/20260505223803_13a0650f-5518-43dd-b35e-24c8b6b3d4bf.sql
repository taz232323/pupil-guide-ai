CREATE POLICY "Teachers insert notifications for their class students"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.class_members cm
    JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.student_id = notifications.user_id
      AND c.teacher_id = auth.uid()
  )
);