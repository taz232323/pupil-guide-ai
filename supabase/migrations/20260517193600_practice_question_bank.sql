-- Practice Question Bank: teacher-submitted questions for daily practice
CREATE TABLE IF NOT EXISTS practice_question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'short_answer')),
  prompt TEXT NOT NULL,
  options JSONB, -- for multiple_choice: ["A", "B", "C", "D"]
  correct_index INTEGER, -- for multiple_choice
  expected_answer TEXT, -- for short_answer
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookups by class
CREATE INDEX idx_practice_question_bank_class ON practice_question_bank(class_id);

-- RLS policies
ALTER TABLE practice_question_bank ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own class questions
CREATE POLICY "Teachers can manage practice questions"
  ON practice_question_bank
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes WHERE classes.id = practice_question_bank.class_id AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes WHERE classes.id = practice_question_bank.class_id AND classes.teacher_id = auth.uid()
    )
  );

-- Students can read questions for classes they're enrolled in (needed for daily practice)
CREATE POLICY "Students can read practice questions for enrolled classes"
  ON practice_question_bank
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members WHERE class_members.class_id = practice_question_bank.class_id AND class_members.student_id = auth.uid()
    )
  );

-- Teacher dismissed prompts: track which prompts teachers have dismissed
CREATE TABLE IF NOT EXISTS teacher_dismissed_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  prompt_key TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, prompt_key, class_id)
);

-- RLS for dismissed prompts
ALTER TABLE teacher_dismissed_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own dismissed prompts"
  ON teacher_dismissed_prompts
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
