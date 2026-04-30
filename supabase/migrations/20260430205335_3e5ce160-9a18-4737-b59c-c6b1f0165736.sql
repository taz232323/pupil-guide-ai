-- Add editable presentation columns
ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '🎁';

-- Backfill descriptions/emojis for existing seeded items
UPDATE public.shop_items SET description = 'A pointy hat for your avatar.', emoji = '🧙' WHERE item_key = 'hat_wizard';
UPDATE public.shop_items SET description = 'Stay cool in class.', emoji = '🕶️' WHERE item_key = 'glasses';
UPDATE public.shop_items SET description = 'Royal vibes, silver tier.', emoji = '👑' WHERE item_key = 'crown_silver';
UPDATE public.shop_items SET description = 'For the truly studious.', emoji = '😇' WHERE item_key = 'halo';
UPDATE public.shop_items SET description = 'Beep boop.', emoji = '🤖' WHERE item_key = 'robot';
UPDATE public.shop_items SET description = 'Glow around your avatar.', emoji = '🌈' WHERE item_key = 'rainbow_aura';
UPDATE public.shop_items SET description = 'Skip one homework assignment (teacher approval required).', emoji = '📝' WHERE item_key = 'homework_pass';
UPDATE public.shop_items SET description = 'Swap seats with a classmate for a day.', emoji = '🔄' WHERE item_key = 'seat_swap';

-- Teachers can manage the shop catalog
CREATE POLICY "Teachers can insert shop items"
  ON public.shop_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can update shop items"
  ON public.shop_items
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can delete shop items"
  ON public.shop_items
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

-- Teachers also need to read inactive items for management
CREATE POLICY "Teachers can view all shop items"
  ON public.shop_items
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));