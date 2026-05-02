
-- 1. Syllabus on classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS syllabus text;

-- 2. Modules
CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_modules_class ON public.modules(class_id, position);

-- 3. Module item types
CREATE TYPE public.module_item_type AS ENUM ('lesson', 'announcement', 'file', 'link', 'assignment');

-- 4. Module items
CREATE TABLE public.module_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  item_type public.module_item_type NOT NULL,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  -- lesson / announcement
  content_html text,
  -- file
  file_path text,
  file_name text,
  -- link
  url text,
  -- assignment
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_module_items_module ON public.module_items(module_id, position);

-- 5. Completions
CREATE TABLE public.module_item_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.module_items(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, student_id)
);
CREATE INDEX idx_mic_student ON public.module_item_completions(student_id);

-- 6. Triggers for updated_at
CREATE TRIGGER trg_modules_updated BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_module_items_updated BEFORE UPDATE ON public.module_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. RLS
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_item_completions ENABLE ROW LEVEL SECURITY;

-- Modules: teachers manage in their classes; students view in joined classes
CREATE POLICY "Teachers manage modules in own classes" ON public.modules
  FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()))
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()));

CREATE POLICY "Students view modules in joined classes" ON public.modules
  FOR SELECT TO authenticated
  USING (public.is_class_member(class_id, auth.uid()));

-- Module items: same via parent module
CREATE POLICY "Teachers manage items in own classes" ON public.module_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.modules m WHERE m.id = module_items.module_id AND public.is_class_teacher(m.class_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.modules m WHERE m.id = module_items.module_id AND public.is_class_teacher(m.class_id, auth.uid())));

CREATE POLICY "Students view items in joined classes" ON public.module_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.modules m WHERE m.id = module_items.module_id AND public.is_class_member(m.class_id, auth.uid())));

-- Completions
CREATE POLICY "Students view own completions" ON public.module_item_completions
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students insert own completions" ON public.module_item_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1 FROM public.module_items mi
      JOIN public.modules m ON m.id = mi.module_id
      WHERE mi.id = module_item_completions.item_id
        AND public.is_class_member(m.class_id, auth.uid())
    )
  );

CREATE POLICY "Students delete own completions" ON public.module_item_completions
  FOR DELETE TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Teachers view completions in own classes" ON public.module_item_completions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.module_items mi
    JOIN public.modules m ON m.id = mi.module_id
    WHERE mi.id = module_item_completions.item_id
      AND public.is_class_teacher(m.class_id, auth.uid())
  ));

-- 8. Storage bucket for module files (public-readable)
INSERT INTO storage.buckets (id, name, public)
VALUES ('module-files', 'module-files', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone authenticated can read (public bucket also allows anon, but fine)
CREATE POLICY "Module files are publicly readable" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'module-files');

-- Teachers can upload/manage files in their own classes (path layout: <class_id>/<filename>)
CREATE POLICY "Teachers upload module files for own classes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'module-files'
    AND public.is_class_teacher(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Teachers update module files for own classes" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'module-files'
    AND public.is_class_teacher(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Teachers delete module files for own classes" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'module-files'
    AND public.is_class_teacher(((storage.foldername(name))[1])::uuid, auth.uid())
  );
