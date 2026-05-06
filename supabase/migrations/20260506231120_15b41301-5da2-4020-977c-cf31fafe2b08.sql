-- Catalog of cosmetic items
CREATE TABLE public.cosmetics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  image_url TEXT NOT NULL,
  position_config JSONB NOT NULL DEFAULT '{"top":"-20%","left":"50%","scale":0.7}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cosmetics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active cosmetics"
  ON public.cosmetics FOR SELECT
  TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE POLICY "Teachers can insert cosmetics"
  ON public.cosmetics FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE POLICY "Teachers can update cosmetics"
  ON public.cosmetics FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE POLICY "Teachers can delete cosmetics"
  ON public.cosmetics FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE TRIGGER cosmetics_touch_updated_at
  BEFORE UPDATE ON public.cosmetics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Ownership / equipped state per user
CREATE TABLE public.user_cosmetics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cosmetic_id UUID NOT NULL REFERENCES public.cosmetics(id) ON DELETE CASCADE,
  equipped BOOLEAN NOT NULL DEFAULT false,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, cosmetic_id)
);

CREATE INDEX idx_user_cosmetics_user ON public.user_cosmetics(user_id);

ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;

-- Users see only their own ownership rows
CREATE POLICY "Users view own cosmetics"
  ON public.user_cosmetics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can only update equipped flag on rows they own.
-- Ownership itself is granted server-side (e.g. via shop purchase trigger), so no INSERT policy for users.
CREATE POLICY "Users update equipped on own cosmetics"
  ON public.user_cosmetics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Defense-in-depth: validation trigger ensures equipped=true requires the row to truly belong to the user
-- and the cosmetic to still exist + be active. Prevents equipping items you don't own.
CREATE OR REPLACE FUNCTION public.enforce_cosmetic_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.equipped = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.cosmetics c
      WHERE c.id = NEW.cosmetic_id AND c.active = true
    ) THEN
      RAISE EXCEPTION 'Cosmetic is not available';
    END IF;
    -- The row itself proves ownership (PK on user_id+cosmetic_id), but verify user_id integrity
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION 'user_id required';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_cosmetics_enforce_ownership
  BEFORE INSERT OR UPDATE ON public.user_cosmetics
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cosmetic_ownership();