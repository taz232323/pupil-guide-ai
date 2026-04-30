ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_teacher_id_fkey;
ALTER TABLE public.class_members DROP CONSTRAINT IF EXISTS class_members_student_id_fkey;

NOTIFY pgrst, 'reload schema';